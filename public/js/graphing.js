(function(window, $) {
    var slice = Array.prototype.slice;

    function Graph(builder) {
        this.datasets = [];
        this.builder = builder;
    }
    Graph.prototype.add_dataset = function(info, rrd, alldata, index) {
        this.datasets.push(info);
        if(!this.title) {
            this.title = info.title;
        }
        if(!this.id) {
            this.id = info.graph;
        }
        delete info.title;
        delete info.graph;
        var data = [];
        var start = rrd.start;
        var step = rrd.step;
        for(var i = 0, ni = alldata.length; i < ni; ++i) {
            data.push([(start+step*i) * 1000, alldata[i][index]]);
        }
        info.data = data;
    }
    function suffix_formatter(val, axis) {
        var diff = axis.max - axis.min;
        var prec = 0;
        if (diff > 1000000000) {
            prec = -8;
        } else if (diff > 1000000) {
            prec = -5;
        } else if (diff > 1000) {
            prec = -2;
        } else if (diff > 10) {
            prec = 0;
        } else if (diff > 2) {
            prec = 1;
        } else if (diff > 0.1) {
            prec = 2;
        } else {
            prec = 3;
        }

        if (val > 1000000000) {
            prec += 9;
            return (val / 1000000000).toFixed(Math.max(prec, 0)) + " G";
        } else if (val > 1000000) {
            prec += 6;
            return (val / 1000000).toFixed(Math.max(prec, 0)) + " M";
        } else if (val > 1000) {
            prec += 3;
            return (val / 1000).toFixed(Math.max(prec, 0)) + " k";
        } else {
            return val.toFixed(Math.max(prec, 0));
        }
    }
    Graph.prototype.make_div = function() {
        this.drawn = false;
        this.div = $("<div class='graph'>").attr('id', this.id);
        var self = this;
        this.div.bind('plothover', function (event, pos, item) {
            if(item) {
                var dt = new Date();
                dt.setTime(item.datapoint[0]);
                $("#tooltip").text(suffix_formatter(item.datapoint[1],
                                                    item.series.yaxis)
                        + ' at ' + dt)
                    .css({'left': item.pageX + 5, 'top': item.pageY + 5 })
                    .show();
            } else {
                $("#tooltip").hide();
            }
        }).bind('plotselected', function(event, ranges) {
            self.yranges = ranges;
            self.invalidate();
            self.builder.set_xrange(ranges.xaxis);
        });
        return this.div;
    }
    Graph.prototype.draw = function() {
        if(this.drawn) return false;
        $.plot(this.div, this.datasets, {
            'grid': { "hoverable": true },
            'crosshair': { "mode": $("#selmode").val() },
            'selection': { "mode": $("#selmode").val() },
            'legend': { 'position': 'nw' },
            'xaxis': {
                "mode": "time",
                "min": this.xrange && this.xrange.from,
                "max": this.xrange && this.xrange.to
                },
            'yaxes': [{
                'tickFormatter': suffix_formatter,
                'reserveSpace': true,
                'labelWidth': 64,
                'position': 'left'
                }, {
                'tickFormatter': suffix_formatter,
                'labelWidth': 64,
                'reserveSpace': true,
                'position': 'right'
                }]
            });
        this.drawn = true;
        return true;
    }
    Graph.prototype.invalidate = function() {
        this.drawn = false;
    }

    function Rules() {
        this.rules = [];
    }
    Rules.prototype.add_rule = function (rule) {
        this.rules.push(rule);
    }
    Rules.prototype.filter_files = function (files) {
        var output = [];
        var tm = +new Date();
        for(var i = 0, ni = files.length; i < ni; ++i) {
            var fn = files[i];
            for(var j = 0, nj = this.rules.length; j < nj; ++j) {
                var rule = this.rules[j];
                if(rule.match_rrd.test(fn)) {
                    output.push(fn);
                    break;
                }
            }
        }
        console.log("Matched", output.length, 'in', +new Date() - tm, 'ms');
        return output;
    }
    var _skip_props = {'match_rrd': 1, 'match_item': 2};
    var _subst_props = {'group': 1, 'graph': 1, 'title': 1, 'label': 1};
    function _substitute(src, values) {
        var tgt = {};
        for(var i in src) {
            if(i in _skip_props)
                continue;
            if(i in _subst_props) {
                tgt[i] = src[i].format(values);
            } else {
                tgt[i] = src[i];
            }
        }
        return tgt;
    }
    Rules.prototype.make_graphs = function (rrds, builder) {
        var tm = +new Date();
        var groups = {};
        var graphs = {};
        for(var i = 0, ni = rrds.length; i < ni; ++i) {
            var rrd = rrds[i];
            var fn = rrd.filename;
            for(var j = 0, nj = this.rules.length; j < nj; ++j) {
                var rule = this.rules[j];
                var m = rule.match_rrd.exec(fn);
                if(!m)
                    continue;
                subs = {'rrd': m};
                for(var k = 0, nk = rrd.datasets.length; k < nk; ++k) {
                    var mi = rule.match_item;
                    if(typeof mi === 'string') {
                        m = (mi == rrd.datasets[k]) ? mi : null;
                    } else {
                        m = mi.exec(rrd.datasets[k]);
                    }
                    if(!m) {
                        continue;
                    }
                    subs.item = m;
                    var gparams = _substitute(rule, subs);
                    var g = graphs[gparams.graph];
                    if(g) {
                        g.add_dataset(gparams, rrd, rrd.data, k);
                    } else {
                        g = new Graph(builder);
                        g.add_dataset(gparams, rrd, rrd.data, k);
                        graphs[g.id] = g;
                        var gr = groups[gparams.group];
                        if(gr) {
                            gr.push(g);
                        } else {
                            groups[gparams.group] = [g];
                        }
                    }
                }
            }
        }
        console.log("Grouped", groups, graphs,
                    "in", +new Date() - tm, 'ms');
        return groups;
    }

    function Builder(rule_file, urls) {
        this.rule_file = rule_file;
        this.urls = urls;
        this._cur_requests = [];
        var self = this;
        this.clean_requests = function () {
            var req = self._cur_requests;
            for(var i = 0, ni = req.length; i < ni; ++i) {
                req[i].abort();
            }
            self._cur_requests = [];
        }
    }
    Builder.prototype._request = function _request(props) {
        var req = $.ajax(props);
        this._cur_requests.push(req);
        return req;
    }
    Builder.prototype.download = function download() {
        var urls = this.urls;
        var rule_file = this.rule_file;
        var requests = [];
        var self = this;
        requests.push(
            this._request({
                'url': rule_file,
                'dataType': 'script'
            }).pipe(null, function() {
                return self._request({
                    'url': '/js/default_rules.js',
                    'dataType': 'script'
                    });
            }));
        for(var i = 0, ni = urls.length; i < ni; ++i) {
            console.log("URLS", urls);
            requests.push(this._request({
                'url': urls[i] + '/index.json',
                'dataType': 'json'
                }).pipe(function(lst) {
                    var url = this.url;
                    // stripping out /index.json
                    url = url.substr(1, url.length - 11);
                    for(var i = 0, ni = lst.length; i < ni; ++i) {
                        // stripping out .rrd
                        lst[i] = url + lst[i].substr(0, lst[i].length-4);
                    }
                    return lst;
                }));
        }
        $.when.apply(null, requests)
            .always(this.clean_requests)
            .done(loaded_basic_data);

        var self = this;
        function loaded_basic_data(rules_file) {
            var rules = window.current_rules;
            this.rules = rules;
            var filenames = [];
            for(var i = 1, ni = arguments.length; i < ni; ++i) {
                filenames = filenames.concat(arguments[i]);
            }
            self.load_graphs(rules, filenames);
        }
    }

    Builder.prototype.load_graphs = function(rules, filenames) {
        this.rules = rules;
        filenames = rules.filter_files(filenames);
        this.filenames = filenames;
        var requests = [];
        var tm = +new Date()/1000;
        var period = $("#period").val();
        var step = Math.round(period / 720);
        for(var i = 0, ni = filenames.length; i < ni; ++i) {
            requests.push(this._request({
                'url': filenames[i]+'.rrd.json'
                    + '?start=' + (tm-period)
                    + '&end=' + tm + '&step=' + step + '&cf=AVERAGE',
                'dataType': 'json'
                }).pipe(function(rrd, status, req) {
                    rrd.filename = this.url.split('.rrd.json')[0];
                    return rrd;
                }));
        }
        var self = this;
        $.when.apply($, requests).then(function () {
            self.process_rrds(arguments);
        });
    }

    Builder.prototype.process_rrds = function(rrds) {
        var allgr = this.all_graphs = [];
        var graphs = this.rules.make_graphs(rrds, this);
        var cont = $("#content");
        var menu = $("#menu");
        for(var i in graphs) {
            var glist = graphs[i];
            cont.append($('<a>').attr('name', i));
            menu.append($("<li>").append(
                $('<a>').attr('href', '#'+i).text(i)
                ));
            cont.append($('<h2>').text(i || ''));
            for(var j = 0, nj = glist.length; j < nj; ++j) {
                var gr = glist[j];
                cont.append($('<h3>').text(gr.title || ''));
                cont.append(gr.make_div());
                allgr.push(gr);
            }
        }
        this.graphs = graphs;
        this.draw_visible();
        var self = this;
        $(window).scroll(function(ev) { self.draw_visible(); });
    }
    Builder.prototype.draw_visible = function() {
        var tm = +new Date();
        var top = $(window).scrollTop();
        var bottom = top + $(window).height();
        var gr = this.all_graphs, lo = 0, hi = gr.length;
        // bisect left
        while(lo < hi) {
            var mid = (lo + hi) >> 1;
            var d = gr[mid].div;
            var v = d.offset().top;
            if(v < top) lo = mid+1;
            else hi = mid;
        }
        var first = lo;
        lo = 0, hi = gr.length;
        // bisect right
        while(lo < hi) {
            var mid = (lo + hi) >> 1;
            var d = gr[mid].div;
            var v = d.offset().top + d.height();
            if(bottom < v) hi = mid;
            else lo = mid+1;
        }
        var last = Math.min(lo, gr.length - 1);
        var drawn = 0;
        for(var i = first; i <= last; ++i) {
            if(gr[i].draw()) {
                drawn += 1;
            }
        }
        if(drawn) {
            console.log("Drawn", drawn, "in", +new Date() - tm, 'ms');
        }
    }
    Builder.prototype.stop = function stop() {
        this.clean_requests();
    }
    Builder.prototype.clean = function clean() {
        this.all_graphs = null;
        $("#content").empty();
        $("#menu").empty();
        this.xrange = null;
    }
    Builder.prototype.redownload = function redownload() {
        this.stop();
        this.clean();
        this.load_graphs(this.rules, this.filenames);
    }
    Builder.prototype.redraw = function() {
        for(var i = 0, ni = this.all_graphs.length; i < ni; ++i) {
            this.all_graphs[i].invalidate();
        }
        this.draw_visible();
    }
    Builder.prototype.set_xrange = function(range) {
        this.xrange = range;
        for(var i = 0, ni = this.all_graphs.length; i < ni; ++i) {
            this.all_graphs[i].xrange = range;
        }
        this.redraw();
    }

    window.Builder = Builder;
    window.Rules = Rules;
})(this, jQuery);

jQuery(function($) {
    var url = location.pathname;
    if(url.substr(-5) == '.html') {
        url = url.substr(0, url.length-5);
    }
    var builder = this.graph_builder = new Builder(url + '.js', [url]);
    builder.download();

    $("#tooltip").hide();
    $("#period").change(function() { builder.redownload(); });
    $("#selmode").change(function() { builder.redraw(); });
    $("#reset").change(function() { builder.redraw(); });

    function select_next(selector) {
        var sel = $(selector);
        var all = $("option", sel).length;
        sel.prop('selectedIndex', (sel.prop('selectedIndex') + 1) % all);
        sel.change();
    }
    function select_prev(selector) {
        var sel = $(selector);
        var all = $("option", sel).length;
        sel.prop('selectedIndex', (sel.prop('selectedIndex') + all - 1) % all);
        sel.change();
    }

    var hk = new Hotkeys();
    hk.add_key('ph', function() { $('#period').val('3600').change(); });
    hk.add_key('pd', function() { $("#period").val('86400').change(); });
    hk.add_key('pw', function() { $("#period").val('604800').change(); });
    hk.add_key('pm', function() { $("#period").val('2678400').change(); });
    hk.add_key('py', function() { $("#period").val('31622400').change(); });
    hk.add_key('P', function() { select_next("#period"); });
    hk.add_key('<C-p>', function() { select_prev("#period"); });
    hk.add_key('sx', function() { $("#selmode").val('x').change(); });
    hk.add_key('sy', function() { $("#selmode").val('y').change(); });
    hk.add_key('sb', function() { $("#selmode").val('xy').change(); });
    hk.add_key('S', function() { select_next("#selmode"); });
    hk.add_key('<C-s>', function() { select_prev("#selmode"); });
    hk.add_key('<space>', function() { $("#reset").click(); });
    hk.add_key('<C-space>', function() { builder.redownload(); });
    hk.bind_to(document);

});
