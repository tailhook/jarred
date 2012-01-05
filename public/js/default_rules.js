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

})(this, jQuery);
