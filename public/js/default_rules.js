(function(window, $) {

    var rules = new Rules();

    // CPU & Memory
    rules.add_rule({
        match_rrd: /^([^/]+)\/memory\/memory-(\w+)$/,
        match_item: 'value',
        group: '{rrd.1}',
        graph: '{rrd.1}-cpumem',
        title: 'CPU & Memory',
        label: "Memory {rrd.2}",
        yaxis: 2,
        stack: true,
        lines: { "show": true, "fill": true}
        });
    rules.add_rule({
        match_rrd: /^([^/]+)\/load\/load$/,
        match_item: 'shortterm',
        group: '{rrd.1}',
        graph: '{rrd.1}-cpumem',
        title: 'CPU & Memory',
        label: 'Load average',
        yaxis: 1
        });

    // Interfaces
    rules.add_rule({
        match_rrd: /^([^/]+)\/interface-((?!lo\/)\w+)\/if_octets$/,
        match_item: /^([rt]x)$/,
        group: '{rrd.1}',
        graph: '{rrd.1}-network-{rrd.2}',
        title: 'Network at {rrd.2}',
        label: 'Bytes {item.1}',
        yaxis: 1
        })
    rules.add_rule({
        match_rrd: /^([^/]+)\/interface-((?!lo\/)\w+)\/if_packets$/,
        match_item: /^([rt]x)$/,
        group: '{rrd.1}',
        graph: '{rrd.1}-network-{rrd.2}',
        title: 'Network at {rrd.2}',
        label: 'Packets {item.1}',
        yaxis: 2
        })

    // Disk
    rules.add_rule({
        match_rrd: /^([^/]+)\/disk-(sd[abc])\/disk_octets$/,
        match_item: /^.*$/,
        group: '{rrd.1}',
        graph: '{rrd.1}-disk_octets-{rrd.2}',
        title: 'Disk throughtput {rrd.2}',
        label: 'Bytes {item.0}',
        yaxis: 1
        })
    rules.add_rule({
        match_rrd: /^([^/]+)\/disk-(sd[abc])\/disk_time$/,
        match_item: /^.*$/,
        group: '{rrd.1}',
        graph: '{rrd.1}-disk_time-{rrd.2}',
        title: 'Average seek time',
        label: '{item.0} time, ms',
        yaxis: 1
        })

    // Nginx
    rules.add_rule({
        match_rrd: /^([^/]+)\/nginx\/nginx_requests$/,
        match_item: 'value',
        group: '{rrd.1}',
        graph: '{rrd.1}-nginx',
        title: 'Nginx',
        label: 'Requests',
        yaxis: 2
        });
    rules.add_rule({
        match_rrd: /^([^/]+)\/nginx\/nginx_connections$/,
        match_item: 'active',
        group: '{rrd.1}',
        graph: '{rrd.1}-nginx',
        title: 'Nginx',
        label: 'Active connections',
        yaxis: 1
        });

    // Processes
    rules.add_rule({
        match_rrd: /^([^/]+)\/processes-(\w+)\/ps_cputime$/,
        match_item: /^.*$/,
        group: '{rrd.1}',
        graph: '{rrd.1}-proc_{rrd.2}',
        title: 'Process {rrd.2}',
        label: '{item.0} time (~%)',
        stack: true,
        lines: { "show": true, "fill": true},
        yaxis: 1
        });
    rules.add_rule({
        match_rrd: /^([^/]+)\/processes-(\w+)\/ps_rss$/,
        match_item: 'value',
        group: '{rrd.1}',
        graph: '{rrd.1}-proc_{rrd.2}',
        title: 'Process {rrd.2}',
        label: 'Memory (RSS)',
        yaxis: 1
        });
    // Roundtrips
    rules.add_rule({
        match_rrd: /^([^/]+)\/ping\/ping-(.*)$/,
        match_item: 'value',
        group: 'Roundtrips',
        graph: 'roundtrips-{rrd.2}',
        title: 'Roundtrips to {rrd.2}',
        label: 'RT from {rrd.1}',
        yaxis: 1
        });
    rules.add_rule({
        match_rrd: /^([^/]+)\/ping\/ping_droprate-(.*)$/,
        match_item: 'value',
        group: 'Roundtrips',
        graph: 'roundtrips-{rrd.2}',
        title: 'Roundtrips to {rrd.2}',
        label: 'Drop from {rrd.1}',
        yaxis: 2
        });


    window.current_rules = rules;

    if(window.current_hosts) {
        var urls = [];
        for(var i = 0, ni = window.current_hosts.length; i < ni; ++i) {
            urls.push('/' + window.current_hosts[i]);
        }
        window.current_urls = urls;
    } else {
        var url = location.pathname;
        if(url.substr(-5) == '.html') {
            url = url.substr(0, url.length-5);
        }
        window.current_urls = [url];
    }

})(this, jQuery);
