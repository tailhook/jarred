jQuery(function($) {
    var tree = {};
    var tm = Math.round((new Date()).getTime()/1000);
    var plot;
    $.ajax({
        'url': '/rrd/',
        'dataType': 'json',
        'success': buildtree
        });
    $.ajax({
        'url': '/rrd/main.gafol.net/ping/ping-rock.insollo.com.rrd?start='+(tm-86400)+'&end='+tm+'&step=60&cf=AVERAGE',
        'dataType': 'json',
        'success': buildgraph
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


    function buildtree(json) {
        for(var i in json) {
            var parts = i.split('/');
            console.assert(!parts[0]);
            host = parts[1];
            plug_inst = parts[2].split('-');
            plug = plug_inst.splice(0, 1)[0];
            pinst = plug_inst.join('-');
            type_inst = parts[3].split('-');
            type = type_inst.splice(0, 1)[0];
            tinst = type_inst.join('-');
            tinst = tinst.split('.');
            tinst.splice(tinst.length-1, 1);
            tinst = tinst.join('.');
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
            $("#allgraphs").append($('<a href="javascript:void(0);">')
                .click(function () {
                    loadgraph($(this).data('path'));
                }).data('path', i).text(i)).append(' ');
        }
        console.log(tree);
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
        for(var i = 0; i < json.data.length; ++i) {
            var val = [i*json.step + json.start];
            val.push.apply(val, json.data[i]);
            data.push(val);
        }
        if(!plot) {
            plot = $.plot($("#graph"), [], {
                'grid': { 'hoverable': true },
                'xaxis': { 'mode': 'time' }
            });
        } else {
            plot.setData([ data ]);
            plot.setupGrid();
            plot.draw();
        }
    }
})
