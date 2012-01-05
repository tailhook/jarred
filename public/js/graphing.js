(function(window, $) {
    var slice = Array.prototype.slice;

    function Graph() {
        this.datasets = [];
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
    Graph.prototype.make_div = function() {
        this.drawn = false;
        this.div = $("<div class='graph'>").attr('id', this.id);
        return this.div;
    }
    Graph.prototype.draw = function() {
        if(this.drawn) return false;
        $.plot(this.div, this.datasets, {
            'grid': { "hoverable": true },
            'crosshair': { "mode": $("#selmode").val() },
            'selection': { "mode": $("#selmode").val() },
            'xaxis': { "mode": "time" }
            });
        this.drawn = true;
        return true;
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
    Rules.prototype.make_graphs = function (rrds) {
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
                        console.log("SKIPPED", rrd.datasets[k], mi);
                        continue;
                    }
                    subs.item = m;
                    var gparams = _substitute(rule, subs);
                    var g = graphs[gparams.graph];
                    if(g) {
                        g.add_dataset(gparams, rrd, rrd.data, k);
                    } else {
                        g = new Graph();
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
        var requests = [$.ajax({
            'url': rule_file,
            'dataType': 'script'
            }).pipe(null, function() {
                return $.ajax({
                    'url': '/js/default_rules.js',
                    'dataType': 'script'
                    });
            })];
        for(var i = 0, ni = urls.length; i < ni; ++i) {
            requests.push($.ajax({
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
        $.when.apply(null, requests).done(loaded_basic_data);

        var self = this;
        function loaded_basic_data(rules_file) {
            var rules = window.current_rules;
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
        var requests = [];
        var tm = +new Date()/1000;
        var period = $("#period").val();
        console.log("PERIOD", period);
        var step = Math.round(period / 720);
        for(var i = 0, ni = filenames.length; i < ni; ++i) {
            requests.push($.ajax({
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
        var graphs = this.rules.make_graphs(rrds);
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


    window.Builder = Builder;
    window.Rules = Rules;
})(this, jQuery);

jQuery(function($) {
    var url = location.pathname;
    if(url.substr(-5) == '.html') {
        url = url.substr(0, url.length-5);
    }
    this.graph_builder = new Builder(url + '.js', [url]);

    $("#tooltip").hide();

});
