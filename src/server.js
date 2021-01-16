import express from 'express';
import bodyParser from 'body-parser';
import { MongoClient } from 'mongodb';
import path from 'path';

const app = express();
const https = require('https');
const http = express();
const fs = require('fs');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/build')));

const withDB = async (operations, res) => {
  try {
    const client = await MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true });
    const db = client.db('my-blog');

    await operations(db);

    client.close();
  } catch (error) {
    res.status(500).json({ message: 'Error connecting to db', error });
  }
}

// Gets the Article Name
app.get('/api/articles/:name', async (req, res) => {
  withDB(async (db) => {
    const articleName = req.params.name;
    const articleInfo = await db.collection('articles').findOne({ name: articleName });
    res.status(200).json(articleInfo);
  }, res);
});

// Allows users to upvote
app.post('/api/articles/:name/upvote', async (req, res) => {
  withDB(async (db) => {
    const articleName = req.params.name;
    const articleInfo = await db.collection('articles').findOne({ name: articleName });

    await db.collection('articles').updateOne({ name: articleName }, {
      '$set': {
        upvotes: articleInfo.upvotes +1, 
      },
    });

    const updatedArticleInfo = await db.collection('articles').findOne({ name: articleName });

    res.status(200).json(updatedArticleInfo);
  }, res);
});

// Adds comments
app.post('/api/articles/:name/add-comment', (req, res) => {  
  withDB(async (db) => {
    const { username, text } = req.body;
    const articleName = req.params.name;
    
    const articleInfo = await db.collection('articles').findOne({ name: articleName});
    await db.collection('articles').updateOne({ name: articleName }, {
      '$set': {
        comments: articleInfo.comments.concat({ username, text }),
      },
    });
    
    const updatedArticleInfo = await db.collection('articles').findOne({ name: articleName });
    
    res.status(200).json(updatedArticleInfo);
  }, res);
});

// Redirects all non API Calls to the static page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/build/index.html'));
});

// Sets up a HTTPS SERVER
const httpsServer = https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/dev.thomaspickup.co.uk/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/dev.thomaspickup.co.uk/fullchain.pem'),
}, app);

httpsServer.listen(443, () => {
    console.log('HTTPS Server running on port 443');
});

// Redirects the HTTP URL to HTTPS
http.get('*', function(req, res) {  
    res.redirect('https://' + req.headers.host + req.url);
});

http.listen(80);