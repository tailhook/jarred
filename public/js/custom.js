jQuery(function($) {
    var builder = null;
    function build_graphs(tree) {
        var selected = tree.get_selected().map(function(i, el) {
            return $(el).data('filename');
        }).get();
        if(!selected.length) return;
        console.log("selected", selected);
        if(builder) {
            builder.stop();
            builder.clean();
        }
        builder = new Builder(new CustomRules(), selected, $("#content"));
        builder.load_graphs();

        $("#period").unbind('change')
            .change(function() { builder.redownload(); });
        $("#selmode").unbind('change')
            .change(function() { builder.redraw(); });
        $("#mode").unbind('change')
            .change(function() { builder.redownload(); });
        $("#reset").unbind('click')
            .click(function() { builder.reset(); });
        $("#refresh").unbind('click')
            .click(function() { builder.redownload(); });
    }
    $.ajax({
        'url': '/index.json',
        'dataType': 'json'
    }).then(function(data) {
        $("#menu").jstree({
            "json_data": {
                'ajax': {
                    'url': function(node) {
                        return '/' + node.text().trim() + '/index.json';
                        },
                    'success': function(items, status, resp, req) {
                        items.sort();
                        var prefix = req.url.substr(0, req.url.length - 10);
                        var tree = {};
                        var children = [];
                        for(var i = 0, ni = items.length; i < ni; ++i) {
                            var parts = items[i].split('/');
                            var leaf = {
                                'data': parts[1].split('.')[0],
                                'metadata':  {
                                    'filename': prefix
                                        + items[i].substr(0, items[i].length-4)
                                    }
                                };
                            if(tree[parts[0]]) {
                                tree[parts[0]].children.push(leaf);
                            } else {
                                children.push(tree[parts[0]] = {
                                    'data': parts[0],
                                    'children': [ leaf ]
                                    });
                            }
                        }
                        return children;
                        }
                    },
                "data": $.map(data.hosts, function(host) {
                    return {
                        'data': host,
                        'state': 'closed'
                        };
                    })
                },
                "plugins": ["themes", "json_data", "ui", "hotkeys"],
                "themes": {"theme": "default",
                           "url": "/css/jstree/default/style.css"}
            }).bind("select_node.jstree", function (event, data) {
                build_graphs(data.inst);
            }).bind("deselect_node.jstree", function(event, data) {
                build_graphs(data.inst);
            });
    });
});
