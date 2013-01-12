var Hogan,
    extname = require('path').extname,
    fs = require('fs'),

    fcache = {},
    fcacheKey;

try {
    // Prefer TECHHEAD fork
    Hogan = require('techhead-hogan');
} catch (ex) {
    Hogan = require('hogan.js');
}

/**
 * Analog to `Hogan.cacheKey()` (as of Hogan 3.0.0)
 * but uses path name instead of template text.
 */
fcacheKey = !!Hogan.cacheKey ? Hogan.cacheKey : function(path, options) {
    return [
        path,
        options.delimiters || '{{ }}',
        !!options.asString,
        !!options.disableLambda
    ].join('||');
};

/**
 * Analog to `Hogan.compile()`
 * but fetches, compiles, and caches the template
 * given a path name instead of the actual template string.
 */
function fcompile(path, options, cache) {
    options = options || {};

    var text, template;

    if (cache) {
        var key = fcacheKey(path, options);
        template = fcache[key];
        if (template) {
            return template;
        }
    }

    text = fs.readFileSync(path, 'utf8');
    template = Hogan.generate(Hogan.parse(Hogan.scan(text, options.delimiters), text, options), text, options);

    path = getExistsSync(path, Object.keys(require.extensions));
    if (path) {

        // The context passed to `template.render()` is the Model (or at least a subset)
        // in the Model-View-Controller pattern.  However, this Model must often be
        // augmented, formatted, etc. in the View for a proper presentation.
        // This presentation logic still belongs to the view, but is oftentimes crammed
        // into the controller for convenience.  This is sloppy and violates the spirit of MVC.

        // This experimental feature provides a convenient pattern for the placement
        // of presentation logic in your view.
        fixTemplateContext(template, loadViewModule(path));
    }

    if (cache) {
        fcache[key] = template;
    }

    return template;
}

/**
 * Takes a path and array of file extensions
 * and returns the first path + extension that exists
 * or returns false.
 */
function getExistsSync(path, exts) {
    for (var i=0,len=exts.length; i<len; i++) {
        if (fs.existsSync(path + exts[i])) {
            return path + exts[i];
        }
    }
    return false;
}

/**
 * Returns a function that takes a hash as an input
 * and returns a specialized 'view' object,
 * complete with presentation logic (eg. view helpers).
 *
 * This may be brittle, as it hijacks the internals of node.js Module.
 */
function loadViewModule(path) {
    var Module = module.constructor,
        _module = new Module(path,module);
    _module.load(path);
    return (typeof _module.exports === 'function') ? _module.exports :
        function(context) {
            return extend(_module.exports, context);
        };
}

/**
 * Override the `template.r()` method of the `Hogan.Template`.
 * to modify/replace the context at the top of the stack.
 *
 * This may be brittle, as `.r()` might be considered an internal method.
 */
function fixTemplateContext(template, fix) {
    var _template_r = template.r;
    template.r = function(contextStack) {
        var context = contextStack[contextStack.length-1];
        contextStack[contextStack.length-1] = fix(context);
        return _template_r.apply(this,arguments);
    };
}

/**
 * Douglas Crockford's classic clone function.
 */
function clone(o) {
    function F() {}
    F.prototype = o;
    return new F();
}

/**
 * Return a new object that inherits from `a`
 * and also contains the properties of `b`.
 */
function extend(a,b) {
    var c = clone(a);
    for (var key in b) {
        c[key] = b[key];
    }
    return c;
}

/**
 * Synchronous Mustache rendering for Express.
 *
 * This method will attempt to autoload from the file system
 * any partials not explicitly passed via the `options` parameter.
 *
 * Options extend `app.locals` when called from `app.render(name,options)`
 * Options extend `response.locals` and `app.locals` when called from `response.render(name,options)`
 * Special Options:
 *
 *   - `cache`  Implicitly set by Express given the value of `settings['view cache']`
 *   - `settings`  Contains values set by `app.set()`, `app.enable()`, `app.disable()`
 *   - `Hogan` or `settings.Hogan`  Options passed to `Hogan.compile(text,options)`
 *   - `layout` or `settings.layout`
 *   - `partials` or `settings.partials`
 */
function render(path, options) {

    var view = this, // The Express View object to which this method is bound
        settings = options.settings || {},
        hoganOptions = extend(settings.Hogan || {}, options.Hogan || {}),
        template, partials, layout = options.layout || settings.layout;

    if (view.template) {
        template = view.template;
        partials = view.partials;
        if (typeof options.partials === 'object') {
            // Allows manual override of partials
            // but does NOT re-resolve.
            partials = extend(view.partials, options.partials);
        }
    } else {
        template = view.template = fcompile(path, hoganOptions, options.cache);
        partials = view.partials = {};
        resolvePartials(template);
    }

    if (layout) {
        var _template = template;
        if (view.layouts && view.layouts[layout]) {
            template = view.layouts[layout];
        } else {
            path = view.lookup(extname(layout) ? layout : layout + view.ext);
            template = fcompile(path, hoganOptions, options.cache);
            resolvePartials(template);
            if (options.cache) {
                if (!view.layouts) view.layouts = {};
                view.layouts[layout] = template;
            }
        }
        partials = clone(partials);
        partials.content = _template;
    }

    /*
     * Ensure that all referenced partials are resolved,
     * compiled and cached within `view.partials`.
     */
    function resolvePartials(template) {

        var keys = {};
        if (template.partials) {    // Hogan 3
            var p = template.partials;
            Object.keys(p).forEach(function(i) {
                keys[ p[i].name ] = 1;
            });
        } else if (template.text) { // Hogan < 3
            Hogan.scan(template.text, hoganOptions.delimiters).forEach(function(token) {
                if (token.tag === '>') {
                    keys[ token.n ] = 1;
                }
            });
        }

        Object.keys(keys).forEach(function(key) {
            if (key in partials) return;

            if (typeof options.partials === 'object' && key in options.partials) {
                template = options.partials[key];
            } else if (typeof settings.partials === 'object' && key in settings.partials) {
                template = settings.partials[key];
            } else {
                var path = view.lookup(key + view.ext);
                template = fs.existsSync(path) ?
                    fcompile(path, hoganOptions, options.cache) : null;
            }

            if (template) {

                if (template instanceof Hogan.Template) {
                } else {
                    // FYI, Hogan.compile does its own caching
                    template = Hogan.compile(template, hoganOptions);
                }

                partials[key] = template;
                resolvePartials(template);
            } else {
                partials[key] = template;
            }
        });
    }

    return template.render(options, partials);
}

exports.__express = function(path, options, fn) {
    try {
        fn(null, render.call(this, path, options));
    } catch (error) {
        fn(error);
    }
};

exports.setEngine = function(engine) {
    if (typeof engine === 'string') {
        Hogan = require(engine);
    } else {
        Hogan = engine;
    }
};
