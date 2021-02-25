describe('Polyline util', function () {

  var util = require('../../lib/index').util;
  var encoded = 'gcneIpgxzRcDnBoBlEHzKjBbHlG`@`IkDxIiKhKoMaLwTwHeIqHuAyGXeB~Ew@fFjAtIzExF';
  var decoded = util.decodePath(encoded);

  it('decodes', function () {
    expect(decoded[0]).toEqual({ lat: 53.489320000000006, lng: -104.16777 });
    expect(decoded[1]).toEqual({ lat: 53.490140000000004, lng: -104.16833000000001 });
    expect(decoded[2]).toEqual({ lat: 53.490700000000004, lng: -104.16936000000001 });
  });

  it('encodes and decodes', function () {
    expect(util.encodePath(decoded)).toEqual(encoded);
  });

});
