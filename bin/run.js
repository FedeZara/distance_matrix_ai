#!/usr/bin/env node


var maps = require('distance_matrix_ai_webservice');
var args = maps.cli.parseArgs(process.argv.slice(3));
var options = {};

if (args.key != undefined) {
  options.key = args.key;
  delete args.key;
}

var client = maps.createClient(options);
var commands = Object.keys(client).join(', ');

try {
  var commandName = process.argv.length > 2 ? process.argv[2] : '';
  var commandFunc = client[commandName];
  if (commandFunc == undefined) {
    throw {
      message: `'${commandName}' is not a valid command, usage is:

distance_matrix_ai_webservice command --arg1 'value1' --arg2 'value2'

where command is one of: ${commands}
`};
  }
  commandFunc(args, maps.cli.callback)
} catch (error) {
  console.log("Error:", error.message);
}
