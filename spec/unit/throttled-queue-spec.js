

var Task = require('../../lib/internal/task');
var MockClock = require('../mock-clock');

describe('throttle', function () {
  var PERIOD = 1000;

  var clock, createQueue, queue, doSomething;
  beforeEach(function () {
    clock = MockClock.create();
    var wait = require('../../lib/internal/wait')
      .inject(clock.setTimeout, clock.clearTimeout);
    createQueue = require('../../lib/internal/throttled-queue')
      .inject(wait, clock.getTime)
      .create;
    queue = createQueue(1, PERIOD);

    var count = 0;
    doSomething = jasmine.createSpy('doSomething')
      .and.callFake(function () {
        ++count;
        return Task.withValue('result ' + count);
      });
  });

  it('doesn\'t do the operation synchronously', function () {
    queue.add(doSomething);
    expect(doSomething).not.toHaveBeenCalled();
  });

  it('calls doSomething', function (done) {
    queue.add(doSomething)
      .finally(function () {
        expect(doSomething).toHaveBeenCalled();
        done();
      });
    clock.run(1000000);
  });

  it('.cancel() cancels an operation', function (done) {
    queue.add(doSomething)
      .thenDo(fail, fail)
      .finally(function () {
        expect(doSomething).not.toHaveBeenCalled();
        done();
      })
      .cancel();
  });

  it('does actions in order', function (done) {
    queue.add(doSomething)
      .thenDo(function (result) {
        expect(result).toBe('result 1');
      }, fail);

    queue.add(doSomething)
      .thenDo(function (result) {
        expect(result).toBe('result 2');
      }, fail);

    queue.add(doSomething)
      .thenDo(function (result) {
        expect(result).toBe('result 3');
      })
      .thenDo(done, fail);

    clock.run(1000000);
  });

  it('does it immediately the first time', function (done) {
    var startTime = clock.getTime();

    queue.add(doSomething)
      .thenDo(function () {
        expect(clock.getTime()).toBe(startTime);
        done();
      });

    clock.run(1000000);
  });

  it('spaces out calls made at the same time', function (done) {
    var startTime = clock.getTime();

    queue.add(doSomething)
      .thenDo(function () {
        expect(clock.getTime()).toBe(startTime);
      }, fail);

    queue.add(doSomething)
      .thenDo(function () {
        expect(clock.getTime()).toBe(startTime + PERIOD);
      }, fail);

    queue.add(doSomething)
      .thenDo(function () {
        expect(clock.getTime()).toBe(startTime + 2 * PERIOD);
      })
      .thenDo(done, fail);

    clock.run(1000000);
  });

  it('spaces out calls made half a PERIOD apart', function (done) {
    var startTime = clock.getTime();

    queue.add(doSomething)
      .thenDo(function () {
        expect(clock.getTime()).toBe(startTime);
      }, fail);

    clock.run(0.5 * PERIOD)
      .thenDo(function () {
        queue.add(doSomething)
          .thenDo(function () {
            expect(clock.getTime()).toBe(startTime + PERIOD);
          })
          .thenDo(done, fail);

        clock.run(1000000);
      });
  });

  it('doesn\'t wait when calls are made far apart', function (done) {
    var startTime = clock.getTime();

    queue.add(doSomething)
      .thenDo(function () {
        expect(clock.getTime()).toBe(startTime);
      }, fail);

    clock.run(2 * PERIOD)
      .thenDo(function () {
        ;
        queue.add(doSomething)
          .thenDo(function () {
            expect(clock.getTime()).toBe(startTime + 2 * PERIOD);
          })
          .thenDo(done, fail);

        clock.run(1000000);
      });
  });

  it('does not wait for calls that are cancelled', function (done) {
    var startTime = clock.getTime();

    queue.add(doSomething)
      .thenDo(function (result) {
        expect(clock.getTime()).toBe(startTime);
        expect(result).toBe('result 1');
      }, fail);

    queue.add(doSomething)
      .thenDo(fail, fail)
      .finally(function () {
        expect(clock.getTime()).toBe(startTime);
      })
      .cancel();

    queue.add(doSomething)
      .thenDo(function (result) {
        expect(clock.getTime()).toBe(startTime + PERIOD);
        expect(result).toBe('result 2');
      })
      .thenDo(done, fail);

    clock.run(1000000);
  });

  describe('when limit is 3', function () {
    beforeEach(function () {
      queue = createQueue(3, PERIOD);
    });

    it('waits before making the 4th call made together', function (done) {
      var startTime = clock.getTime();

      queue.add(doSomething)
        .thenDo(function () {
          expect(clock.getTime()).toBe(startTime);
        }, fail);

      queue.add(doSomething)
        .thenDo(function () {
          expect(clock.getTime()).toBe(startTime);
        }, fail);

      queue.add(doSomething)
        .thenDo(function () {
          expect(clock.getTime()).toBe(startTime);
        }, fail);

      queue.add(doSomething)
        .thenDo(function () {
          expect(clock.getTime()).toBe(startTime + PERIOD);
        })
        .thenDo(done, fail);

      clock.run(1000000);
    });
  });
});
