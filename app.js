var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

let cors = require('cors');

var accounts = require('./routes/accounts'),
  nseProxy = require('./routes/nse-proxy');

var getDatabase = require('./src/dataMapper/Database.js');
var getAccountMapper = require('./src/dataMapper/AccountMapper.js');
var getSnapshotMapper = require('./src/dataMapper/SnapshotMapper.js');
var getStockMapper = require('./src/dataMapper/StockMapper.js') 

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text({ type: 'text/csv' }));
app.use(cors({
  origin: 'http://localhost:3213',
  optionsSuccessStatus: 200
}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/accounts', accounts);
app.use('/nseProxy', nseProxy);

app.get('/stocks', (req, res, next) => {
  if (!req.accepts('application/json')){
    res.status(400).json({error: 'only JSON responses'});
    return;
  }
  app.get('stockMapper').getAllStocks( (err, stocks) =>{
    res.status(200).json({ data: stocks });
  });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

initDbStuff(app);


function initDbStuff(theApp) {
  var pathToDatabase = process.env.STOCKMON_DB || './stockmon.sqlite';
  var database = getDatabase(pathToDatabase);
  theApp.set('db', database);
  theApp.set('accountMapper', getAccountMapper(database));
  theApp.set('snapshotMapper', getSnapshotMapper(database));
  theApp.set('stockMapper', getStockMapper(database));

}


module.exports = app;
