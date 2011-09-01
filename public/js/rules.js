if(!window.jarred_rules) jarred_rules = [];
jarred_rules.push({
    "match": [null, "cpu"],
    "label": "usage",
    "fetch": "*/cpu-*/cpu-idle.rrd",
    "convert": function () {
        var data = [];
        var first = arguments[0];
        for(var j = 0; j < first.data.length; ++j) {
            var val = 0;
            var ts = (first.start + first.step * j) * 1000;
            for(var i = 0; i < arguments.length; ++i) {
                one = arguments[i].data[j][0];
                if(!isNaN(one) && one != null && one < 100)
                    val += 100 - one;
            }
            data.push([ts, val]);
        }
        return [{"label": "CPU Load", "data": data}];
    }
})


