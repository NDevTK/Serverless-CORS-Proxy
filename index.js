const express = require('express');  
const request = require('request');
const replaceStream = require('replacestream');
const app = express();

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Expose-Headers", "X-Final-URL");
    res.header('Cache-Control', 'public, smax-age=600, max-age=600');
    next();
});

function isURL(str) {
  var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
  var pattern = new RegExp(regex); 
  return pattern.test(str);
}

app.get('/', (req, res, next) => {
  url = req.query.url;

  if(!url){ // If no URL specified 
	  return res.send("Hello World");
  }
  
  if(!isURL(url)){ // if URL is not valid
	  return res.send("ERROR: URL NOT VALID");
  }

  if(req.query.a && !req.query.b) {
    // Regex support
    req.pipe(request.get({
      url: url,
      gzip: true,
		  timeout: 1000, // Timeout for Remote Request
		}, (err, headers, body) => {
      res.send(body.match(RegExp(req.query.a, "g")));
    }).on('response', function(response) {
      res.header('X-Final-URL', response.request.uri.href);
    }).on('error', function(err) {
      res.status(504).send("REMOTE ERROR");
    }));
  } else if(req.query.a && req.query.b) {
    // replaceStream support
    req.pipe(request.get({
      url: url,
      timeout: 1000, // Timeout for Remote Request
      gzip: true
		}).on('response', function(response) {
      res.header('X-Final-URL', response.request.uri.href);
    }).on('error', function(err) {
      res.status(504).send("REMOTE ERROR");
    })).pipe(replaceStream(RegExp(req.query.a, "g"), req.query.b, {
      limit: 5000
    })).pipe(res);
  } else {
    // Send directly
    req.pipe(request.get({
      url: url,
		  timeout: 1000, // Timeout for Remote Request
		}).on('response', function(response) {
      res.header('X-Final-URL', response.request.uri.href);
    }).on('error', function(err) {
      res.status(504).send("REMOTE ERROR");
    })).pipe(res); // Send Response
  }
});

app.get('/board', (req, res, next) => {
  const storyboard = /https:\\\/\\\/i9\.ytimg\.com\\\/sb\\\/[A-z0-9_-]{11}\\\/storyboard3_L\$L\\\/\$N\.jpg\?sqp=([0-9A-z+=_-]*)\|.*M\$M#rs\$([0-9A-z+=_-]{34})\|/;
  const videoid = /[A-z0-9_-]{11}/;

  var id = encodeURI(req.query.v);

  if(!id){ // If no ID specified 
	  return res.status(400).send("Need video id!");
  }

  if(!videoid.test(id)) {
    return res.status(400).send("Invalid video id!");
  }
  
  request.get({
    url: "https://www.youtube.com/watch?v="+id,
    gzip: true,
    timeout: 1000, // Timeout for Remote Request
  }, (err, headers, body) => {
    var matchs = body.match(storyboard);
    if(matchs === null) return res.status(404).send("Board not found.");
    var url = ("https://i9.ytimg.com/sb/"+id+"/storyboard3_L1/M0.jpg?sqp="+matchs[1]+"&sigh=rs%24"+matchs[2]).replace(/(\r\n|\n|\r)/gm, "");
    res.send(url);
  }).on('response', function(response) {
    res.header('X-Final-URL', response.request.uri.href);
  }).on('error', function(err) {
    res.status(504).send("REMOTE ERROR");
  });
});

module.exports = app;
