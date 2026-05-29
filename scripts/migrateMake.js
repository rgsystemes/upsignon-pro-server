/* eslint-disable @typescript-eslint/no-var-requires */
var fs = require('fs');
var path = require('path');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getTimestamp() {
  var now = new Date();
  var year = now.getFullYear();
  var month = pad2(now.getMonth() + 1);
  var day = pad2(now.getDate());
  var hours = pad2(now.getHours());
  var minutes = pad2(now.getMinutes());
  var seconds = pad2(now.getSeconds());

  return year + '-' + month + '-' + day + '_' + hours + '-' + minutes + '-' + seconds;
}

var migrationSuffix = process.argv[2] || '';
var migrationName = getTimestamp() + '_' + migrationSuffix;
var migrationFilePath = path.join(__dirname, '../migrations/' + migrationName + '.js');

var template =
  '//' +
  migrationName +
  '\n\n' +
  'exports.up = function(db) {\n' +
  '  return db.query();\n' +
  '}\n\n' +
  'exports.down = function(db) {\n' +
  '  return db.query();\n' +
  '}\n';

fs.writeFileSync(migrationFilePath, template, 'utf8');
