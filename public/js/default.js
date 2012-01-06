jQuery(function($) {
    var url = location.pathname;
    if(url.substr(-5) == '.html') {
        url = url.substr(0, url.length-5);
    }
    $.ajax({
        'url': url + '.js',
        'dataType': 'script'
    }).pipe(null, function() {
        return $.ajax({
            'url': '/js/default_rules.js',
            'dataType': 'script'
            });
    }).pipe(function() {
        return $.when(window.current_rules, window.current_urls);
    }).done(function() {
        var builder = this.graph_builder = new Builder(
            window.current_rules, null, $("#content"), $("#menu"));
        builder.download(window.current_urls);

        $("#period").change(function() { builder.redownload(); });
        $("#selmode").change(function() { builder.redraw(); });
        $("#reset").click(function() { builder.reset(); });
        $("#refresh").click(function() { builder.redownload(); });
    });
});
