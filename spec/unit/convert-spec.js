
var Convert = require('../../lib/internal/convert');
var Validate = require('../../lib/internal/validate');
var InvalidValueError = Validate.InvalidValueError;

describe('Convert', function () {

  describe('.pipedKeyValues', function () {

    it('rejects non-objects', function () {
      expect(function () {
        Convert.pipedKeyValues('hello')
      }).toThrowError(InvalidValueError, /not an Object/);
    });

    it('works with primitive values as properties', function () {
      var testObject = { foo: 'bar', baz: 'bing' }
      var pipedString = Convert.pipedKeyValues(testObject)
      expect(pipedString).toEqual('baz:bing|foo:bar');
    });

    it('works with arrays as properties', function () {
      var testObject = { foo: 'bar', baz: ['bing', 'bong'] }
      var pipedString = Convert.pipedKeyValues(testObject)
      expect(pipedString).toEqual('baz:bing|baz:bong|foo:bar');
    });

  });

});
