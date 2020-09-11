const express = require('express');  
const request = require('request');
const cloudscraper = require('cloudscraper');
const fetch = require('node-fetch');
const replaceStream = require('replacestream');

const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

const app = express();

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Expose-Headers", "X-Final-URL");
  res.header('Cache-Control', 'public, smax-age=600, max-age=600');
  next();
});

// Must be disable before deploy
const DevMode = false;

async function getOptions () {
  if (DevMode) {
    return {
      args: [],
      executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
    };
  }
  return {
    args: chrome.args,
    executablePath: await chrome.executablePath,
    headless: chrome.headless,
  };
};

async function renderPage(url) {
  var html = null;
  const options = await getOptions();
  var browser = await puppeteer.launch(options);
  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image') {
      req.abort();
    } else {
      req.continue();
    }
  });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
  await page.goto(url);
  await page.waitFor('*');
  html = await page.content();
  await browser.close();
  return html
}

function isURL(str) {
  var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
  var pattern = new RegExp(regex); 
  return pattern.test(str);
}

app.all('/', async (req, res, next) => {
  var url = req.query.url;
  var regex = (req.query.a) ? RegExp(req.query.a, "g") : null;

  if(!url){ // If no URL specified 
	  return res.send("Hello World");
  }
  
  if(!isURL(url)){ // if URL is not valid
	  return res.send("ERROR: URL NOT VALID");
  }
  
  if(req.query.cf && !req.query.js) {
    // Cloudflare support
    let result = await cloudscraper.get({
      url: url,
      gzip: true,
      followAllRedirects: true
    });
    if(result.statusCode !== 200) return res.status(504).send("REMOTE ERROR");
    let body = (regex) ? result.body.match(regex) : result.body;
    res.header('X-Final-URL', result.finalUrl);
    res.send(body);
  } else if(req.query.js) {
    // Javascript support
    let data = await renderPage(url);
    if(data === null) return res.status(400).send("ERROR");
    data = (regex) ? data.match(regex) : data;
    res.send(data);
  } else if(regex && !req.query.b) {
    // Regex support
    req.pipe(request.get({
      url: url,
      gzip: true,
		  timeout: 1000, // Timeout for Remote Request
		}, (err, headers, body) => {
      res.send(body.match(regex));
    }).on('response', function(response) {
      res.header('X-Final-URL', response.request.uri.href);
    }).on('error', function(err) {
      res.status(504).send("REMOTE ERROR");
    }));
  } else if(regex && req.query.b) {
    // replaceStream support
    req.pipe(request.get({
      url: url,
      timeout: 1000, // Timeout for Remote Request
      gzip: true
		}).on('response', function(response) {
      res.header('X-Final-URL', response.request.uri.href);
    }).on('error', function(err) {
      res.status(504).send("REMOTE ERROR");
    })).pipe(replaceStream(regex, req.query.b, {
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

app.all('/board', (req, res, next) => {
  const storyboard = /https:\\\/\\\/i\.ytimg\.com\\\/sb\\\/[a-z0-9_-]{11}\\\/storyboard3_L\$L\\\/\$N\.jpg\?sqp=([0-9a-z+=_-]+)\|.*M\$M#rs\$([0-9A-z+=_-]{34})\|/i;
  const videoid = /[a-z0-9_-]{11}/i;

  var id = encodeURI(req.query.v);

  if(!id){ // If no ID specified 
	  return res.status(400).send("Need video id!");
  }

  if(!videoid.test(id) || id.length !== 11) {
    return res.status(400).send("Invalid video id!");
  }

  request.get({
    url: "https://www.youtube.com/watch?v="+id,
    gzip: true,
    timeout: 1000, // Timeout for Remote Request
  }, (err, headers, body) => {
    var matchs = body.match(storyboard);
    if(matchs === null) return res.status(404).send("Board not found.");
    var url = ("https://i.ytimg.com/sb/"+id+"/storyboard3_L1/M0.jpg?sqp="+matchs[1]+"&sigh=rs%24"+matchs[2]);
    res.send(url);
  }).on('response', function(response) {
    res.header('X-Final-URL', response.request.uri.href);
  }).on('error', function(err) {
    res.status(504).send("REMOTE ERROR");
  });
});

app.all('/board/hover', async (req, res, next) => {
  const videoid = /[a-z0-9_-]{11}/i;

  var id = encodeURI(req.query.v);

  if(!id){ // If no ID specified 
	  return res.status(400).send("Need video id!");
  }

  if(!videoid.test(id) || id.length !== 11) {
    return res.status(400).send("Invalid video id!");
  }
  
  const storyboard2 = /"https:\/\/i\.ytimg\.com\/an_webp\/[0-9a-z+=_-]{11}\/mqdefault_6s\.webp\?du=3000\\u0026sqp=([0-9a-z+=_-]*)\\u0026rs=([0-9a-z+=_-]*)"/i;
  var body = await renderPage("https://www.youtube.com/results?search_query="+id+"&sp=EgIQAQ%253D%253D");
  if(body === null) return res.status(400).send("ERROR");
  let matchs = body.match(storyboard2);
  if(matchs === null) return res.status(404).send("Board not found.");
  var url = ("https://i.ytimg.com/an_webp/"+id+"/mqdefault_6s.webp?du=3000&sqp="+matchs[1]+"&rs="+matchs[2]);
  res.send(url);
});

app.all('/board/all', async (req, res, next) => {
  const storyboard = /https:\\\/\\\/i\.ytimg\.com\\\/sb\\\/[a-z0-9_-]{11}\\\/storyboard3_L\$L\\\/\$N\.jpg\?sqp=([0-9a-z+=_-]+)\|.*M\$M#rs\$([0-9A-z+=_-]{34})\|/i;
  const storyboard2 = /"https:\/\/i\.ytimg\.com\/an_webp\/[0-9a-z+=_-]{11}\/mqdefault_6s\.webp\?du=3000\\u0026sqp=([0-9a-z+=_-]*)\\u0026rs=([0-9a-z+=_-]*)"/i;
  var output = [];
  const videoid = /[a-z0-9_-]{11}/i;

  var id = encodeURI(req.query.v);

  if(!id){ // If no ID specified 
	  return res.status(400).send("Need video id!");
  }

  if(!videoid.test(id) || id.length !== 11) {
    return res.status(400).send("Invalid video id!");
  }
  
  var body;
  var matchs;
  var url;

  body = await renderPage("https://www.youtube.com/results?search_query="+id+"&sp=EgIQAQ%253D%253D");
  if(body === null) return res.status(400).send("ERROR");
  matchs = body.match(storyboard2);
  if(matchs === null) return res.status(404).send("Board not found.");
  url = ("https://i.ytimg.com/an_webp/"+id+"/mqdefault_6s.webp?du=3000&sqp="+matchs[1]+"&rs="+matchs[2]);
  output.push(url);

  body = await renderPage("https://www.youtube.com/watch?v="+id);
  if(body === null) return res.status(400).send("ERROR");
  matchs = body.match(storyboard);
  if(matchs === null) return res.status(404).send("Board not found.");
  url = ("https://i.ytimg.com/sb/"+id+"/storyboard3_L1/M0.jpg?sqp="+matchs[1]+"&sigh=rs%24"+matchs[2]);
  output.push(url);

  res.send(output);
});

function cleanResult(result) {
  return result.substring(9, result.length - 2);
}

function cleanResult2(result) {
  return result.substr(1);
}

app.all('/channels', async (req, res, next) => {
  const channel = /\/youtube\/[c|channel]\/[a-z0-9-_]*">/gi;
  var body = "";
  for (var type of ["100", "category/autos", "category/comedy", "category/education", "category/entertainment", "category/games", "category/made-for-kids", "category/music", "category/news", "category/nonprofit", "category/people", "category/animals","category/tech", "category/shows", "category/sports","category/travel"]) {
     result = await cloudscraper.get("https://socialblade.com/youtube/top/"+type+"/mostviewed");
	 body += result;
  }
  let matchs = body.match(channel);
  matchs = matchs.map(cleanResult);
  if(matchs === null) return res.status(404).send("Channels not found.");
  res.send([...new Set(matchs)]);
});

app.all('/popular', async (req, res, next) => {
  let matchs = await cloudscraper.get("https://invidio.us/api/v1/popular");
  matchs = matchs.map(cleanResult2);
  if(matchs === null) return res.status(404).send("Channels not found.");
  res.send([...new Set(matchs)]);
});


module.exports = app;
