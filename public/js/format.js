(function() {
  // Python-like format function
  var FORMAT_SUBST = /\{([^:{}]*)(:[^{}]*)?\}/g;
  var F_FLOAT = /^:(\+?)(\d*)(?:\.(\d+))?f$/;
  var F_INT = /^:(\+?)(\d*)d$/;
  var F_STRING = /^:(\-?)(\d*)s$/;
  var F_CHECK_INT = /^\d+$/;
  var slice = Array.prototype.slice;
  function fillleft(str, len, fillchar) {
    var i, length, ni;
    if (fillchar == null) {
          fillchar = ' ';
    }
    length = str.length;
    if (length < len) {
      for (i = 0, ni = len - length - 1; i <= ni; i++) {
        str = fillchar + str;
      }
    }
    return str;
  };
  function fillright(str, len, fillchar) {
    var i, length, ni;
    if (fillchar == null) {
      fillchar = ' ';
    }
    length = str.length;
    if (length < len) {
      for (i = 0, nl = len - length - 1; i <= ni; i++) {
        str = str + fillchar;
      }
    }
    return str;
  };
  numFormat = function(value, sign, len, prec) {
    var length, result;
    result = Number(value).toFixed(prec);
    length = parseInt(len);
    if (prec <= 0 && result.charAt(result.length - 1) === '.') {
      result = result.substr(0, result.length - 1);
    }
    if (length && len.charAt(0) === '0') {
      if (value >= 0) {
        if (sign) {
          result = '+' + fillleft(result, length - 1, '0');
        } else {
          result = fillleft(result, length, '0');
        }
      } else {
        result = '-' + fillleft(result.substr(1), length - 1, '0');
      }
    } else {
      if (sign && value >= 0) {
        result = '+' + result;
      }
      result = fillleft(result, length);
    }
    return result;
  };
  String.prototype.format = function() {
    var args, index;
    args = slice.call(arguments, 0);
    index = 0;
    return this.replace(FORMAT_SUBST, function(val, name, fmt) {
      var key, parts, prop, result, subst, value, _i, _len, _ref;
      var subst = slice.call(arguments, 3);
      if (name) {
        parts = name.split('.');
        key = parts[0];
        if (key) {
          if (F_CHECK_INT.test(key)) {
            value = args[parseInt(key)];
          } else {
            value = args[0][key];
          }
        } else {
          value = args[index++];
        }
        if (parts.length > 1) {
          _ref = parts.slice(1);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            key = _ref[_i];
            value = value != null ? value[key] : void 0;
          }
        }
      } else {
        value = args[index++];
      }
      if (fmt) {
        switch (fmt.slice(-1)) {
          case 'd':
            prop = F_INT.exec(fmt);
            if (!prop) {
              throw "Wrong format '" + fmt + "'";
            }
            result = numFormat(value, prop[1], prop[2], 0);
            break;
          case 'f':
            prop = F_FLOAT.exec(fmt);
            if (!prop) {
              throw "Wrong format '" + fmt + "'";
            }
            result = numFormat(value, prop[1], prop[2], prop[3]);
            break;
          case 's':
            prop = StringUtils.SF_STRING.exec(fmt);
            if (!prop) {
              throw "Wrong format '" + fmt + "'";
            }
            if (prop[2]) {
              if (prop[1]) {
                result = fillright(value, prop[2]);
              } else {
                result = fillleft(value, prop[2]);
              }
            } else {
              result = value;
            }
            break;
          case 'r':
            result = value.toString();
            break;
          default:
            throw "Wrong format '" + fmt + "'";
        }
      } else {
        result = value;
      }
      return result;
    });
  };
  String.prototype.startswith = function(prefix) {
    return str.substr(0, prefix.length) === prefix;
  };
  String.prototype.endswith = function(suffix) {
    return str.substr(-suffix.length) === suffix;
  };
  if (!String.prototype.trim) {
    String.prototype.trim = function() {
      return this.replace(/(^\s+)|(\s+$)/g, "");
    };
  }
}).call(this);
