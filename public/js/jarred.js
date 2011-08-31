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

    function _mktree(name, obj, lev) {
        if(lev > 4) return {
            "data": name,
            "attr": { "rrd": obj.rrd }
            };
        var children = [];
        for(var i in obj) {
            children.push(_mktree(i, obj[i], lev+1));
        }
        return {
            "data": name,
            "children": children
            }
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
        jstree = _mktree('root', tree, 0);
        $("#menu").jstree({
            "json_data": {
                "data": jstree.children
                },
            "plugins": ["themes", "json_data", "ui"],
            "themes": {"theme": "default", "url": "/css/jstree/default/style.css"}
        }).bind('loaded.jstree', function() {
            $("#menu li > a").click(function () {
                var path = $(this).parent().attr('rrd');
                if(!path) return;
                loadgraph(path);
            });
        });
    }

    function loadgraph(path) {
        $.ajax({
            'url': '/rrd'+path+'?start='+(tm-86400)+'&end='+tm+'&step=60&cf=AVERAGE',
            'dataType': 'json',
            'success': buildgraph
            });
    }

    function buildgraph(json) {
        var data = [];
        for(var j = 0; j < json.data[0].length; ++j) {
            data.push([]);
        }
        for(var i = 0; i < json.data.length; ++i) {
            var row = json.data[i];
            var tm = (i*json.step + json.start)*1000;
            for(var j = 0; j < row.length; ++j) {
                var val = [tm, row[j]];
                data[j].push(val)
            }
        }
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
