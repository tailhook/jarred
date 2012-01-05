function Hotkeys() {
    var self = this;
    var bindings = {};
    var state = null;

    this.allow_input = false;

    // public methods

    this.bind_to = function (el) {
        jQuery(el).keydown(handler);
    }
    this.unbind_from = function (el) {
        jQuery(el).unbind('keydown', handler);
    }
    this.add_key = function(key, fun) {
        jQuery.each(key.split(' '), function(i, val) { add_key(val, fun); });
    }
    this.handle = function(key, owner) {
        this.reset();
        var lst = key.match(/<[^>]+>|./g);
        jQuery.each(lst, function(i, val) { handle(val, owner); });
        this.reset();
    }
    this.reset = function() {
        state = null;
    }
    function add_key(key, fun) {
        var lst = key.match(/<[^>]+>|./g);
        if(lst.length < 1) return;
        var tmp = bindings;
        while(lst.length > 1) {
            var single = lst.shift();
            if(!(single in tmp)) {
                tmp = tmp[single] = {};
            } else {
                tmp = tmp[single];
            }
            if(typeof tmp == 'function')
                throw Error("Conflicting binding \"" + key + "\"");
        }
        tmp[lst[0]] = fun;
    }
    function handle(key, owner) {
        var nstate = state;
        if(!nstate) nstate = bindings;
        nstate = nstate[key];
        if(!nstate) {
            state = null;
            return true;
        }
        if(typeof nstate == 'function') {
            state = null;
            nstate(owner);
            return false;
        }
        state = nstate;
        return false;
    }

    // private methods

    function handler(ev) {
        if ((/textarea|select/i.test(ev.target.nodeName)
            || ev.target.type === "text")
            && !self.allow_input) {
            return;
        }

        var special = ev.type !== "keypress"
            && self.specialKeys[ ev.which ];
        var key = String.fromCharCode( ev.which ).toLowerCase();
        if(special) {
            key = special;
        }

        if ( ev.ctrlKey && special !== "ctrl" ) {
            key = "C-" + key;
        }

        if ( ev.shiftKey && special !== "shift" ) {
            if(special) {
                key = 'S-' + key;
            } else {
                key = key.toUpperCase();
            }
        }

        if(key.length > 1) {
            key = '<'+key+'>';
        }
        return handle(key, ev.target);
    }
    return this;
}

Hotkeys.prototype.specialKeys = {
    8: "backspace", 9: "tab", 13: "return", 16: "shift", 17: "ctrl", 18: "alt",
    19: "pause", 20: "capslock", 27: "esc", 32: "space", 33: "pageup", 34:
    "pagedown", 35: "end", 36: "home", 37: "left", 38: "up", 39: "right", 40:
    "down", 45: "insert", 46: "del", 96: "0", 97: "1", 98: "2", 99: "3", 100:
    "4", 101: "5", 102: "6", 103: "7", 104: "8", 105: "9", 106: "*", 107: "+",
    109: "-", 110: ".", 111 : "/", 112: "f1", 113: "f2", 114: "f3", 115: "f4",
    116: "f5", 117: "f6", 118: "f7", 119: "f8", 120: "f9", 121: "f10", 122:
    "f11", 123: "f12", 144: "numlock", 145: "scroll", 191: "/",
    219: "[",
    221: "]",
    224: "meta"
    };

Hotkeys.prototype.shiftNums = {
    "`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7":
    "&", "8": "*", "9": "(", "0": ")", "-": "_", "=": "+", ";": ": ", "'":
    "\"", ",": "<", ".": ">",  "/": "?",  "\\": "|"
    };
