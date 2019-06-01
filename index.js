const express = require('express');  
const request = require('request');
const cors = require('cors')
const app = express();  

app.use(function(req, res, next) {
    res.header('Cache-Control', 'public, smax-age=600, max-age=600');
    next();
});

function isURL(str) {
  var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
  var pattern = new RegExp(regex); 
  return pattern.test(str);
}

app.get('/', cors(), (req, res, next) => {
  url = req.query.url;
  if(!url){
	  res.send("Hello World");
	  return
  }
  if(!isURL(url)){
	  res.send("ERROR: URL NOT VALID")
	  return;
  }
  
  data = req.pipe(request(url))
  res.header('X-Finel-URL', data.uri.href);
  data.pipe(res);
});

module.exports = app;
