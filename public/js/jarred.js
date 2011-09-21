jQuery(function($) {
    var tree = {};
    var flatdict = {};
    var filelist = [];
    var tm = Math.round((new Date()).getTime()/1000);
    var selected = [];
    var lastgraph;
    var range = {};
    var queue = [];
    $.ajax({
        'url': '/rrd/',
        'dataType': 'json',
        'success': $('body').hasClass('custom') ? buildanddraw : buildpresets
        });

    $("#tooltip").hide();
    $("#period").change(rebuildgraph);
    function setperiod(ev) {
        $("#period")[0].selectedIndex = parseInt(ev.data) - 1;
        rebuildgraph();
    }
    for(var i = 1, n = $('option', $("#period")).length+1; i < n; ++i) {
        $(window).keydown(i.toString(), setperiod);
    }
    $("#mode").change(rebuildgraph);
    $(window).keydown('m', function setperiod(ev) {
        var sel = $("#mode")[0];
        sel.selectedIndex = (sel.selectedIndex + 1) %
            $("option", $("#mode")).length;
        rebuildgraph();
    });
    $("#selmode").change(redrawgraphs);
    $(window).keydown('s', function setperiod(ev) {
        var sel = $("#selmode")[0];
        sel.selectedIndex = (sel.selectedIndex + 1) %
            $("option", $("#selmode")).length;
        redrawgraphs(); // TODO(tailhook) can just redraw
    });
    function resetgraphs() {
        range = {};
        $("#graph div.graph").data('ranges', null);
        redrawgraphs();
    }
    $("#reset").click(resetgraphs);
    $(window).keydown('esc', resetgraphs);

    setInterval(function () {
        if(queue.length) {
            var st = $(window).scrollTop();
            var wh = $(window).height();
            for(var i = 0, ni = queue.length; i < ni; ++i) {
                var item = queue[i];
                var div = item[1];
                if(!div) continue;
                var off = div.offset();
                var h = div.height();
                if(off.top+h > st && off.top < st + wh) {
                    queue.splice(i, 1);
                    break;
                }
            }
            if(i >= ni) {
                item = queue[0];
                queue.splice(0, 1);
            }
            _drawgraph.apply(this, item);
            if(!queue.length) {
                $("#loader").hide();
            } else {
                $("#loader").text(queue.length).show();
            }
        }
    }, 100);

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
        allfiles = json;
        for(var j = 0; j < json.length; ++j) {
            var i = json[j];
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
            if(!ttinst) {
                ttinst = ttype[tinst] = {
                    'rrd': i
                    };
            }
            flatdict[i] = ttinst;
        }
    }

    function buildpresets(json) {
        queue = [];
        buildtree(json);
        var collection = {
            'sections': [],
            'add_section': function add_section(title) {
                this.cursection = { 'title': title, "graphs": [] };
                this.sections.push(this.cursection);
            },
            'add_graph': function add_graph(info, datarules) {
                info['datasets'] = datarules;
                this.cursection.graphs.push(info);
            }
        };
        jarred_presets(collection, tree);
        var menu = $('<ul class="contents">').appendTo($("#menu").empty());
        var canvas = $("#graph").empty();
        for(var i = 0, ni = collection.sections.length; i < ni; ++i) {
            var sec = collection.sections[i];
            var sdiv = $("<div>")
                .attr('id', 'section_' + i)
                .append($('<h2>').text(sec.title))
                .appendTo(canvas);
            $('<li>').append($("<a>")
                .attr('href', '#section_'+ i)
                .text(sec.title)
                ).appendTo(menu);
            for(var j = 0, nj = sec.graphs.length; j < nj; ++j) {
                var graf = sec.graphs[j];
                $("<h3>").text(graf.title).appendTo(sdiv);
                var gdiv = $("<div class='graph'>").appendTo(sdiv);
                var gbuilder = graphbuilder();
                for(var k = 0, nk = graf.datasets.length; k < nk; ++k) {
                    var ds = graf.datasets[k];
                    if(ds.fetch) {
                        gbuilder.add_rule({'rule': ds, 'node': ds.node});
                    } else {
                        gbuilder.add_leaf(ds.node);
                    }
                }
                gbuilder.load((function(div, graf) { return function(data) {
                    for(var i = 0; i < data.length; ++i) {
                        var p = graf.datasets[i];
                        if(!p) break;
                        if(p.label) data[i].label = p.label;
                        if(p.yaxis) data[i].yaxis = p.yaxis;
                        if(p.stack) data[i].stack = p.stack;
                        if(p.lines) data[i].lines = p.lines;
                        if(p.bars) data[i].bars = p.bars;
                        if(p.points) data[i].points = p.points;
                    }
                    if(graf.ranges) {
                        for(var ax in graf.ranges) {
                            var ymax = graf.ranges[ax].minto;
                            for(var i = 0; i < data.length; ++i) {
                                var ds = data[i];
                                if(ds.yaxis != 1) continue;
                                for(var j = 0, jn = ds.data.length; j<jn; ++j){
                                    var v = ds.data[j][1];
                                    if(v > ymax) ymax = v;
                                }
                            }
                            graf.ranges[ax].to = ymax;
                        }
                    }
                    queue.push([data, div, graf.ranges]);
                    div.bind('redraw', function () {
                        var rng = $(this).data('ranges') || graf.ranges;
                        queue.push([data, div, rng]);
                    });
                }})(gdiv, graf));
            }
        }
        $("#graph div.graph").bind('plotselected', function(event, ranges) {
            $(this).data('ranges', ranges).trigger('redraw');
        });
    }

    function buildanddraw(json) {
        queue = [];
        buildtree(json);
        var jstree = _mktree('root', tree, []);
        $("#menu").jstree({
            "json_data": {
                "data": jstree.children
                },
            "plugins": ["themes", "json_data", "ui", "hotkeys"],
            "themes": {"theme": "default",
                       "url": "/css/jstree/default/style.css"}
        }).bind("select_node.jstree", function (event, data) {
            selected = data.inst.get_selected();
            rebuildgraph();
        }).bind("deselect_node.jstree", function (event, data) {
            selected = data.inst.get_selected();
            rebuildgraph();
        });
    }

    function rebuildgraph() {
        queue = [];
        range = {};
        if($('body').hasClass('custom')) {
            var builder = graphbuilder();
            $.each(selected, function (k, v) {
                var data = $(v).data();
                if(data.leaf)
                    builder.add_leaf(data.leaf)
                else if(data.rule)
                    builder.add_rule(data);
            });
            builder.load(drawgraphs);
        } else {
            buildpresets(allfiles);  // TODO(tailhook) may be optimize a little
        }
    }

    function redrawgraphs() {
        queue = [];
        range = {};
        if($('body').hasClass('custom')) {
            drawgraphs(lastgraph);
        } else {
            $("#graph div.graph").trigger('redraw');
        }
    }

    function graphbuilder() {
        var files = {};
        var collections = [];

        return {
           "add_leaf": function (leaf) {
                if(!files[leaf.rrd]) {
                    files[leaf.rrd] = [];
                }
                var coll = {
                    "callback": convertgraph,
                    "data": []
                    };
                files[leaf.rrd].push(coll);
                collections.push(coll);
                },
            "add_rule": function (data) {
                var rrds = rulefiles(data);
                var coll = {
                    "callback": data.rule.convert,
                    "rule": data.rule,
                    "data": []
                    };
                for(var i = 0, n = rrds.length; i < n; ++i) {
                    if(!files[rrds[i].rrd]) {
                        files[rrds[i].rrd] = [];
                    }
                    files[rrds[i].rrd].push(coll);
                }
                collections.push(coll);
                },
            "load": function (callback) {
                var total = 0;
                var loaded = 0;
                var period = $("#period").val();
                var step = Math.round(period / 720);
                for(var i in files) {
                    ++ total;
                    $.ajax({
                        'url': '/rrd' + i
                            + '?start=' + (tm-period)
                            + '&end=' + tm + '&step=' + step + '&cf=AVERAGE',
                        'dataType': 'json',
                        'rrdpath': i,
                        'success': function(json) {
                            var ff = files[this.rrdpath];
                            for(var i = 0, n = ff.length; i < n; ++i) {
                                ff[i].data.push(json);
                            }
                            ++loaded;
                            if(loaded < total) return;

                            var gdata = [];
                            for(var i = 0, n = collections.length; i < n; ++i) {
                                var coll = collections[i];
                                var ar = coll.callback.apply(
                                    coll.rule, coll.data);
                                if(ar) {
                                    gdata.push.apply(gdata, ar);
                                }
                            }
                            callback(gdata);
                        }
                    });
                }
            }
        };
    };

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

    function rulefiles(rule) {
        var subtree = rule.node;
        if(!subtree) {
            subtree = tree;
            for(var i = 0; i < rule.stack.length; ++i) {
                subtree = subtree[rule.stack[i]];
            }
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
        return filtered;
    }

    function convertgraph(json) {
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
        return data;
    }

    function suffix_formatter(val, axis) {
        if (val > 1000000000)
            return (val / 1000000000).toFixed(1) + " G";
        else if (val > 1000000)
            return (val / 1000000).toFixed(1) + " M";
        else if (val > 1000)
            return (val / 1000).toFixed(1) + " k";
        else if (val > 10)
            return val.toFixed(0);
        else if (val > 2)
            return val.toFixed(1);
        else if (val > 0.1)
            return val.toFixed(2);
        else
            return val.toFixed(3);
    }

    function _mkaxes(ranges, num) {
        var rng = ranges.yaxis
        var axes = [ {
            'tickFormatter': suffix_formatter,
            'min': rng && rng.from,
            'max': rng && rng.to
            } ];
        for(var i = 2; i <= num; ++i) {
            rng = ranges['y' + i + 'axis'];
            axes.push({
                'tickFormatter': suffix_formatter,
                'min': rng && rng.from,
                'max': rng && rng.to
                });
        }
        return axes;
    }

    function _drawgraph(data, div, ranges) {
        if(!ranges) ranges = range;
        $.plot(div, data, {
            'grid': { "hoverable": true },
            'crosshair': { "mode": $("#selmode").val() },
            'selection': { "mode": $("#selmode").val() },
            'xaxis': {
                "mode": "time",
                "min": ranges.xaxis && ranges.xaxis.from,
                "max": ranges.xaxis && ranges.xaxis.to,
                },
            'yaxes': _mkaxes(ranges, data.length)
            });
        div.bind('plothover', function (event, pos, item) {
            if(item) {
                var dt = new Date();
                dt.setTime(item.datapoint[0]);
                $("#tooltip").text(suffix_formatter(item.datapoint[1])
                        + ' at ' + dt)
                    .css({'left': item.pageX + 5, 'top': item.pageY + 5 })
                    .show();
            } else {
                $("#tooltip").hide();
            }
        });
    }

    function drawgraphs(data) {
        lastgraph = data;
        var $g = $("#graph").empty()
        switch($("#mode").val()) {
            case "normal":
                var div = $('<div class="graph">');
                $("#graph").append(div);
                queue.push([data, div]);
                break;
            case "multi-axes":
                for(var i = 0; i < data.length; ++i) {
                    data[i].yaxis = i+1;
                }
                var div = $('<div class="graph">');
                $("#graph").append(div);
                queue.push([data, div]);
                break;
            case "multi-graph":
                for(var i = 0; i < data.length; ++i) {
                    var div = $('<div class="graph">');
                    $("#graph").append(div);
                    queue.push([[data[i]], div]);
                }
                break;
            case "sum":
                var ngraph = data[0];
                for(var i = 1; i < data.length; ++i) {
                    var cur = data[i].data;
                    for(var j = 0; j < cur.length; ++j) {
                        var v = cur[j][1];
                        console.assert(ngraph.data[j][0] == cur[j][0]);
                        if(v == null || isNaN(v)) {
                            ngraph.data[j][1] = null;
                        } else {
                            ngraph.data[j][1] += v;
                        }
                    }
                    ngraph.label += '+'+data[i].label;
                }
                var div = $('<div class="graph">');
                $("#graph").append(div);
                queue.push([[ngraph], div]);
                break;
            case "diff":
                var ngraph = data[0];
                for(var i = 1; i < data.length; ++i) {
                    var cur = data[i].data;
                    for(var j = 0; j < cur.length; ++j) {
                        var v = cur[j][1];
                        console.assert(ngraph.data[j][0] == cur[j][0]);
                        if(v == null || isNaN(v)) {
                            ngraph.data[j][1] = null;
                        } else {
                            ngraph.data[j][1] -= v;
                        }
                    }
                    ngraph.label += '-'+data[i].label;
                }
                var div = $('<div class="graph">');
                $("#graph").append(div);
                queue.push([[ngraph], div]);
                break;
            default:
                throw "Mode node implemented";
                break;
        }
        $("#graph div.graph").bind('plotselected', function (event, ranges) {
            range = ranges;
            drawgraphs(data);
        });
    }

    // Utility functions

    window.jarred = {
        'sum': function sum(values, fun) {
            var data = [];
            var start = 0;
            var first = values[0];
            for(var j = 0; j < first.data.length; ++j) {
                var val = 0;
                var ts = (first.start + first.step * j) * 1000;
                for(var i = 0; i < values.length; ++i) {
                    one = values[i].data[j][0];
                    if(isNaN(one) || one == null) {
                        // Better nothing than wrong value
                        val = null;
                        break;
                    }
                    if(fun) {
                        val += fun(one);
                    } else {
                        val += one;
                    }
                }
                data.push([ts, val]);
            }
            return [{"data": data}];
        }
    };
})
