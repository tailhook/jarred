(function (window, $) {

    window.current_hosts = [
        'h1.2056.ru',
        'static1.2056.ru'
        ];

    window.current_hosts = $.ajax({
        'url': '/index.json',
        'dataType': 'json'
    }).pipe(function(data) {
        window.current_hosts = data.hosts;
        return data.hosts;
    });
    window.current_rules = $.when(window.current_hosts).pipe(function() {
        return $.ajax({
            'url': '/js/default_rules.js',
            'dataType': 'script'
        });
    });

})(this, jQuery);
