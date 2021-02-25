var Promise = require('q').Promise;
var MockClock = require('../mock-clock');
var parse = require('url').parse;
const { v4: uuid4 } = require('uuid');

describe('index.js:', function () {
  var createClient, requestAndSucceed, requestAndFail, requestTimes, clock;
  beforeEach(function () {
    clock = MockClock.create();
    createClient = require('../../lib/index').createClient;

    requestTimes = [];

    requestAndSucceed = jasmine.createSpy('requestAndSucceed')
      .and.callFake(function (url, onSuccess) {
        requestTimes.push(clock.getTime());
        onSuccess({
          status: 200,
          json: { status: 'OK' }
        });
      });

    requestAndFail = jasmine.createSpy('requestAndFail')
      .and.callFake(function (url, onSuccess) {
        requestTimes.push(clock.getTime());
        onSuccess({ status: 500 });
      });
  });

  describe('parsing the body as JSON', function () {
    it('populates the response.json property', function (done) {
      createClient({ makeUrlRequest: requestAndSucceed })
        .geocode({ address: 'Sydney Opera House' }, function (err, response) {
          expect(err).toBe(null);
          expect(response).toEqual(jasmine.objectContaining({
            status: 200,
            json: { status: 'OK' }
          }));
          done();
        });
    });

  });

  describe('using a client ID and secret', function () {
    it('generates a signature param', function (done) {
      createClient({
        clientId: 'foo',
        clientSecret: 'a2V5',
        makeUrlRequest: function (url) {
          expect(parse(url, true).query.signature)
            .toBe('Wqh6_J7zAuZHQOQgHwOehx4Wr6g=');
          done();
        }
      })
        .geocode({ address: 'Sesame St.' });
    });

    it('includes the channel if specified', function (done) {
      createClient({
        clientId: 'foo',
        clientSecret: 'a2V5',
        channel: 'bar',
        makeUrlRequest: function (url) {
          expect(parse(url, true).query.channel)
            .toBe('bar');
          done();
        }
      })
        .geocode({ address: 'Sesame St.' });
    });
  });

  describe('using a language param', function () {
    it('can set the language per client', function (done) {
      createClient({
        language: 'en-AU',
        makeUrlRequest: function (url) {
          expect(parse(url, true).query.language)
            .toBe('en-AU');
          done();
        }
      })
        .geocode({ address: 'Sesame St.' });
    });

    it('can override the language per method', function (done) {
      createClient({
        language: 'en-AU',
        makeUrlRequest: function (url) {
          expect(parse(url, true).query.language)
            .toBe('en-GB');
          done();
        }
      })
        .geocode({ address: 'Sesame St.', language: 'en-GB' });
    });
  });

  describe('posting JSON', function () {
    var geolocateQuery = {
      homeMobileCountryCode: 310,
      homeMobileNetworkCode: 410,
      radioType: 'gsm',
      carrier: 'Vodafone',
      considerIp: true
    };

    it('posts data', function (done) {
      createClient({
        makeUrlRequest: function (url, onSuccess, onError, options) {
          expect(options['body'])
            .toEqual(geolocateQuery);
          done();
        }
      })
        .geolocate(geolocateQuery);
    });

    it('does not include the API key in the post data', function (done) {
      createClient({
        makeUrlRequest: function (url, onSuccess, onError, options) {
          expect(options['body'].key)
            .toBe(undefined);
          done();
        }
      })
        .geolocate(geolocateQuery);
    });
  });

  describe('retrying failing requests', function () {
    it('uses retryOptions given to the method', function (done) {
      createClient({
        makeUrlRequest: requestAndFail,
        getTime: clock.getTime,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
      })
        .geocode({
          address: 'Sydney Opera House',
          timeout: 100,
          retryOptions: {
            interval: 30,
            increment: 1,
            jitter: 1e-100
          }
        }, function (err, response) {
          expect(err).toMatch(/timeout/);
          expect(requestTimes).toEqual([0, 30, 60, 90]);
          done();
        });

      clock.run();
    });

    it('uses retryOptions given to the service', function (done) {
      createClient({
        makeUrlRequest: requestAndFail,
        getTime: clock.getTime,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        timeout: 100,
        retryOptions: {
          interval: 30,
          increment: 1,
          jitter: 1e-100
        }
      })
        .geocode({ address: 'Sydney Opera House' }, function (err, response) {
          expect(err).toMatch(/timeout/);
          expect(requestTimes).toEqual([0, 30, 60, 90]);
          done();
        });

      clock.run();
    });
  });

  describe('throttling', function () {
    it('spaces out requests made too close', function (done) {
      var distanceMatrix = createClient({
        makeUrlRequest: requestAndSucceed,
        getTime: clock.getTime,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        rate: { limit: 3, period: 30 }
      });

      distanceMatrix.geocode({ address: 'Sydney Opera House' }, function () { });
      distanceMatrix.geocode({ address: 'Sydney Opera House' }, function () { });
      distanceMatrix.geocode({ address: 'Sydney Opera House' }, function () { });
      distanceMatrix.geocode({ address: 'Sydney Opera House' }, function () {
        expect(requestTimes).toEqual([0, 0, 0, 30]);
        done();
      });

      clock.run();
    });

    it('sends requests ASAP when not bunched up', function (done) {
      var distanceMatrix = createClient({
        makeUrlRequest: requestAndSucceed,
        getTime: clock.getTime,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        rate: { period: 20 }
      });

      distanceMatrix.geocode({ address: 'Sydney Opera House' }, function (err, response) {
        expect(err).toBe(null);
      });

      clock.run(30)
        .thenDo(function () {
          distanceMatrix.geocode({ address: 'Sydney Opera House' }, function (err, response) {
            expect(err).toBe(null);
            expect(requestTimes).toEqual([0, 30]);
            done();
          });
        })
        .thenDo(function () {
          return clock.run();
        });
    });
  });

  describe('.cancel()', function () {
    it('cancels when called immediately', function (done) {
      var handle = createClient({ makeUrlRequest: requestAndSucceed })
        .geocode({ address: 'Sydney Opera House' }, fail)
        .finally(function () {
          expect(requestAndSucceed).not.toHaveBeenCalled();
          done();
        })
        .cancel();
    });

    it('cancels throttled requests', function (done) {
      var distanceMatrix = createClient({
        makeUrlRequest: requestAndSucceed,
        rate: { limit: 1 }
      });

      distanceMatrix.geocode({ address: 'Sydney Opera House' }, function (err, response) {
        expect(err).toBe(null);
        expect(requestAndSucceed).toHaveBeenCalled();
        // At this point, the second request should already have been enqueued,
        // due to throttling.
        handle.cancel();
      });

      var handle =
        distanceMatrix.geocode({ address: 'Sydney Opera House' }, fail)
          .finally(function () {
            expect(requestAndSucceed.calls.count()).toBe(1);
            done();
          });
    });

    it('cancels requests waiting to be retried', function (done) {
      var handle = createClient({ makeUrlRequest: requestAndFail })
        .geocode({ address: 'Sydney Opera House' }, fail)
        .finally(function () {
          expect(requestAndFail).toHaveBeenCalled();
          done();
        });

      requestAndFail.and.callFake(function (url, callback) {
        callback(null, { status: 500 });
        // After the first failure, schedule a cancel.
        setImmediate(function () {
          handle.cancel();
        });
      });
    });

    it('cancels in-flight requests', function (done) {
      var handle =
        createClient({
          makeUrlRequest: function (url, onSuccess) {
            setTimeout(function () {
              requestAndSucceed(url, onSuccess);
            }, 10);
            // By this stage, the request is in-flight.
            handle.cancel();
          }
        })
          .geocode({ address: 'Sydney Opera House' }, fail)
          .finally(done)
    });
  });

  describe('using .asPromise()', function () {
    it('delivers responses', function (done) {
      createClient({ Promise: Promise, makeUrlRequest: requestAndSucceed })
        .geocode({ address: 'Sydney Opera House' })
        .asPromise()
        .then(function (response) {
          expect(response).toEqual(jasmine.objectContaining({
            status: 200,
            json: { status: 'OK' }
          }));
        })
        .then(done, fail);
    });

    it('delivers ZERO_RESULTS as success', function (done) {
      createClient({
        Promise: Promise,
        makeUrlRequest: function (url, onSuccess) {
          onSuccess({ status: 200, json: { status: 'ZERO_RESULTS' } });
        }
      })
        .geocode({ address: 'Sydney Opera House' })
        .asPromise()
        .then(function (response) {
          expect(response).toEqual(jasmine.objectContaining({
            status: 200,
            json: { status: 'ZERO_RESULTS' }
          }));
        })
        .then(done, fail);
    });

    it('delivers errors', function (done) {
      createClient({
        Promise: Promise,
        makeUrlRequest: function (url, onSuccess, onError) {
          onError('error');
        }
      })
        .geocode({ address: 'Sydney Opera House' })
        .asPromise()
        .then(fail, function (error) {
          expect(error).toEqual('error');
          done();
        })
    });

    it('delivers REQUEST_DENIED as an error', function (done) {
      createClient({
        Promise: Promise,
        makeUrlRequest: function (url, onSuccess) {
          onSuccess({ status: 200, json: { status: 'REQUEST_DENIED' } });
        }
      })
        .geocode({ address: 'Sydney Opera House' })
        .asPromise()
        .then(fail, function (error) {
          expect(error.json).toEqual({ status: 'REQUEST_DENIED' });
          done();
        })
    });

    it('throws validation errors', function () {
      expect(function () {
        createClient({ Promise: Promise, makeUrlRequest: requestAndSucceed })
          .geocode({ 'uh-oh': 'bogus argument' })
          .asPromise()
          .then(fail);
      }).toThrowError(/uh-oh/);
    });
  });

  it('throws validation errors', function () {
    expect(function () {
      createClient({ makeUrlRequest: requestAndSucceed })
        .geocode({ 'uh-oh': 'bogus argument' }, function (err, response) {
          fail();
        });
    }).toThrowError(/uh-oh/);
  });

  describe('using an experience id', function () {

    it('setExperienceId and getExperienceId should be correct', function () {
      const experienceId = "foo";
      const otherExperienceId = "bar";

      const client = createClient();

      client.setExperienceId(experienceId);
      expect(client.getExperienceId()).toEqual([experienceId]);

      client.setExperienceId(experienceId, otherExperienceId);
      expect(client.getExperienceId()).toEqual([experienceId, otherExperienceId]);
    });

    it('clearExperienceId and client options', function () {
      const experienceId = "foo";

      const client = createClient({ experienceId: experienceId });

      client.clearExperienceId();
      expect(client.getExperienceId()).toEqual(null);

    });

    it('experience id sample', function () {
      // [START maps_experience_id]
      const experienceId = uuid4().toString();

      // instantiate client with experience id
      const client = createClient({ experienceId: experienceId })

      // clear the current experience id
      client.clearExperienceId()

      // set a new experience id
      otherExperienceId = uuid4().toString();
      client.setExperienceId(experienceId, otherExperienceId)

      // make API request, the client will set the header
      // X-GOOG-MAPS-EXPERIENCE-ID: experienceId,otherExperienceId

      // get current experience id
      const ids = client.getExperienceId()
      // [END maps_experience_id]

      expect(ids).toEqual([experienceId, otherExperienceId])
    });

    it('includes the experience id in header', function () {
      const EXPERIENCE_ID_HEADER_NAME = require('../../lib/internal/make-api-call').EXPERIENCE_ID_HEADER_NAME;
      const id = "foo";

      createClient({
        makeUrlRequest: function (_, _, _, options) {
          expect(options['headers'][EXPERIENCE_ID_HEADER_NAME]).toEqual(id);
        },
        experienceId: id
      })
        .geocode({ address: 'Sesame St.' });
    });

  });
});

