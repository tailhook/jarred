jQuery(function($) {
    var tree = {};
    var flatdict = {};
    var jstree = {};
    var tm = Math.round((new Date()).getTime()/1000);
    var plot;
    $.ajax({
        'url': '/rrd/',
        'dataType': 'json',
        'success': buildtree
        });

    $("#tooltip").hide();
    $("#graph").bind('plothover', function (event, pos, item) {
        if(item) {
            var dt = new Date();
            dt.setTime(item.datapoint[0]*1000);
            $("#tooltip").text(item.datapoint[1] + ' at ' + dt)
                .css({'left': item.pageX + 5, 'top': item.pageY + 5 })
                .show();
        } else {
            $("#tooltip").hide();
        }
    });

    function _mktree(name, obj, stack) {
        if(stack.length > 4) return {
            "data": name,
            "metadata": { "leaf": obj }
            };
        var children = [];
        for(var i in obj) {
            children.push(_mktree(i, obj[i], stack.concat([i])));
        }
        res =  {
            "data": name,
            "children": children
            }
        var rlen = jarred_rules.length;
        for(var i = 0; i < rlen; ++i) {
            var rule = jarred_rules[i];
            var m = jarred_rules[i].match;
            var mlen = m.length;
            if(stack.length != mlen) continue;
            var matched = true;
            for(var j = 0; j < mlen; ++j) {
                if(m[j] != null && m[j] != stack[j]) {
                    matched = false;
                    break;
                }
            }
            if(matched) {
                res.children.push({
                    "data": rule.label,
                    "metadata": {
                        "rule": rule,
                        "stack": stack }
                    });
            }
        }
        return res;
    }

    function buildtree(json) {
        flatdict = json;
        for(var i in json) {
            var path = i.split('.');
            path.splice(path.length-1, 1);
            path = path.join('.');
            var parts = path.split('/');
            console.assert(!parts[0]);
            host = parts[1];
            plug_inst = parts[2].split('-');
            plug = plug_inst.splice(0, 1)[0];
            pinst = plug_inst.join('-') || 'default';
            type_inst = parts[3].split('-');
            type = type_inst.splice(0, 1)[0];
            tinst = type_inst.join('-') || 'default';
            var thost = tree[host];
            if(!thost) thost = tree[host] = {};
            var tplug = thost[plug];
            if(!tplug) tplug = thost[plug] = {};
            var tpinst = tplug[pinst];
            if(!tpinst) tpinst = tplug[pinst] = {};
            var ttype = tpinst[type];
            if(!ttype) ttype = tpinst[type] = {};
            var ttinst = ttype[tinst];
            if(!ttinst) ttinst = ttype[tinst] = json[i];
            json[i].rrd = i;
        }
        jstree = _mktree('root', tree, []);
        $("#menu").jstree({
            "json_data": {
                "data": jstree.children
                },
            "plugins": ["themes", "json_data", "ui"],
            "themes": {"theme": "default",
                       "url": "/css/jstree/default/style.css"}
        }).bind('loaded.jstree', function() {
            $("#menu li > a").click(function () {
                var data = $(this).parent().data();
                if(data.leaf) {
                    loadgraph(data.leaf.rrd);
                    return;
                }
                if(data.rule) {
                    loadrule(data);
                    return;
                }
            });
        });
    }

    function loadgraph(path) {
        $.ajax({
            'url': '/rrd'+path
                + '?start='+(tm-86400)+'&end='+tm+'&step=60&cf=AVERAGE',
            'dataType': 'json',
            'success': buildgraph
            });
    }

    function fnmatch_compile(pat) {
        res = ''
        for(var i = 0, n = pat.length; i < n;) {
            c = pat.charAt(i)
            i += 1
            switch(c) {
            case '*':
                res = res + '.*';
                break;
            case '?':
                res = res + '.';
                break;
            case '[':
                j = i
                if(j < n && pat.charAt(j) == '!')
                    j = j+1
                if(j < n && pat.charAt(j) == ']')
                    j = j+1
                while(j < n && pat.charAt(j) != ']')
                    j = j+1
                if(j >= n)
                    res = res + '\\['
                else {
                    stuff = pat.substr(i, j-i).replace('\\','\\\\')
                    i = j+1
                    if(stuff[0] == '!')
                        stuff = '^' + stuff.substr(1)
                    else if(stuff[0] == '^')
                        stuff = '\\' + stuff
                    res = res + '[' + stuff + ']'
                }
                break;
            default:
                // TODO(tailhook) escape more specials
                res = res + c.replace('.', '\\.');
                break;
            }
        }
        return res
    }

    function loadrule(rule) {
        var subtree = tree;
        for(var i = 0; i < rule.stack.length; ++i) {
            subtree = subtree[rule.stack[i]];
        }
        var filtered = []
        var re = new RegExp(fnmatch_compile(rule.rule.fetch));
        function visit(tree) {
            if(tree.rrd) {
                if(re.exec(tree.rrd)) {
                    filtered.push(tree);
                }
                return;
            }
            for(var i in tree) {
                visit(tree[i]);
            }
        }
        visit(subtree);
        var data = [];
        for(var i = 0; i < filtered.length; ++i) {
            $.ajax({
                'url': '/rrd' + filtered[i].rrd
                    + '?start='+(tm-86400)+'&end='+tm+'&step=60&cf=AVERAGE',
                'dataType': 'json',
                'success': function(json) {
                    data.push(json);
                    if(data.length < filtered.length) return;
                    var gdata = rule.rule.convert.apply(this, data);
                    drawgraph(gdata);
                }
            });
        }
    }

    function buildgraph(json) {
        var data = [];
        for(var j = 0; j < json.datasets.length; ++j) {
            data.push({"label": json.datasets[j], "data": []});
        }
        for(var i = 0; i < json.data.length; ++i) {
            var row = json.data[i];
            var tm = (i*json.step + json.start)*1000;
            for(var j = 0; j < row.length; ++j) {
                var val = [tm, row[j]];
                data[j].data.push(val)
            }
        }
        drawgraph(data);
    }
    function drawgraph(data) {
        if(!plot) {
            plot = $.plot($("#graph"), data, {
                'grid': { 'hoverable': true },
                'xaxis': { 'mode': 'time' }
            });
        } else {
            plot.setData(data);
            plot.setupGrid();
            plot.draw();
        }
    }
})
