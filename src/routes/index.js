var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'UML Collaborative Diagram Editor Backend' });
});

/* Health check endpoint */
router.get('/health', function(req, res, next) {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'UML CDP Backend'
  });
});

module.exports = router;
