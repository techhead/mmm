# mmm

[Mustache](http://mustache.github.com/) Marked Media - View Engine for [Express 3](http://expressjs.com/),
  featuring [Hogan.js](https://github.com/twitter/hogan.js)

Supports
  - partials 
  - layout
  - caching

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
````

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
