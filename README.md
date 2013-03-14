# mmm

[Mustache](http://mustache.github.com/) Marked Media - View Engine for [Express 3](http://expressjs.com/),
  featuring [Hogan.js](https://github.com/twitter/hogan.js)

Supports

+ caching
+ partials
+ layout
+ presentation logic (*outside* of logicless template, of course)

## Install

`npm install mmm`

## Usage

### Setup

See [example/app.js](https://github.com/techhead/mmm/blob/master/example/app.js)

Add to your app configuration

    app.set('view engine', 'mmm');

And if you want caching...

    app.enable('view cache'); // Express 3 will enable this by default for production environments

To set an app-wide layout...

    app.set('layout', 'responsive-layout'); // will look for a layout named 'responsive-layout.mmm' in 'views' directory

By default, [mmm](https://github.com/techhead/mmm) prefers the
[TECHHEAD fork of Hogan.js](https://github.com/techhead/hogan.js).
However, you can control this behaviour at runtime by calling
`setEngine`, like so:

```
mmm = require('mmm');

// Use the original fork of Hogan.js
mmm.setEngine('hogan.js');

app.set('view engine', 'html');
app.engine('html', mmm.__express);
```

### Rendering

    app.render('page', // will look for a file named 'page.mmm' in the 'views' directory
               vars);  // vars is expected to be a hash that will be merged onto app.locals

    // or for a response object (res)
    res.render('page', vars); // vars will be merged onto res.locals and app.locals

Example:

    app.locals.a = 1;
    app.locals.b = 1;
    app.locals.c = 1;
    res.locals.a = 2;
    res.locals.b = 2;
    res.render('page', {a: 3});

page.mmm

```
{{a}} {{b}} {{c}}
```

result:

```
3 2 1
```

### Partials

Partials may be explicitly set or automatically loaded from the file system.

    app.set('partials', { header: '<h1>App Name</h1>' }); // Define partial at the app level

    app.render('page', { partials: { menu: '<ul><li>item</li></ul>' } }); // Define partial at render

page.mmm

```
{{>header}}
{{>menu}}
{{>footer}}
```

footer.mmm

```
{{=<% %>=}}
This template will be included in page.mmm automatically if {{>footer}} is not otherwise resolved.
```

### Layout

A layout can be applied either to the entire application or at the call to `render`.

    app.set('layout', 'test');

    // or
    app.render('page', { layout:'test2' });

    // or
    app.render('page', { layout:false }); // Turn off layout

Layout is implemented using partials.  A layout should contain a partial named 'content'.

```
The content will go here --> {{> content}}
```

### Presentation Logic

Although Mustache provides a framework for logic-less templates, some presentation logic will usually be required
in order for your view to render correctly.  The 'logic', in this case, is just applied to the model before passing
it on to the template for rendering, or special view 'helper' methods are attached to the context and these methods
are called from the template.  But *where* in your code this presentation logic appears is important when trying to
maintain a proper SoC (Separation of Concerns) and in conforming to a MVC (Model-View-Controller) architecture.

For example, consider the following controller:

```
exports.controller = function(req, res) {
  var model = { date: new Date() };

  // Presentation Logic: View Helper Example
  model.formattedDate = function() {
    return this.date.toLocaleDateString();
  };

  // Presentation Logic: Pre-format View Model
  model.isoDate = model.date.toISOString();

  res.render('page', model);
};
```

This example is muddled because presentation logic (part of the View in MVC) is being add to the Controller.
The Mustache Marked Media module (mmm) has an established pattern for "binding" such presentation logic to your
view.  Its use is, of course, completely optional.  See the following example.

page.mmm

```
Today's date is {{formattedDate}}.
```

page.mmm.js

```
exports.formattedDate = function() {
  return this.date.toLocaleDateString();
};
```

... or alternatively ...

page.mmm.js

```
module.exports = function(context) {
  context.formattedDate = context.date.toISOString();
  return context;
};
```
