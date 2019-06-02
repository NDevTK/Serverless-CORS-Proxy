const express = require('express');  
const request = require('request');
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
	  res.send("Hello World");
	  return
  }
  
  if(!isURL(url)){ // if URL is not valid
	  res.send("ERROR: URL NOT VALID")
	  return;
  }

  req.pipe(request.get({
	  url: url,
	  timeout: 1000, // Timeout for Remote Request
  }).on('response', function(response) {
	  res.header('X-Final-URL', response.request.uri.href);
  }).on('error', function(err) {
	  res.status(504).send("REMOTE ERROR");
  })).pipe(res); // Send Response
  
});

module.exports = app;
