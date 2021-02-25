
/**
 * Distance Matrix AI service module.
 * @module distance_matrix_ai_webservice
 */

/**
 * Creates a Distance Matrix Ai client. The client object contains all the API methods.
 *
 * @param {Object} options
 * @param {string} options.key API key (required, unless clientID and
 *     clientSecret provided).
 * @param {string=} options.clientId Maps API for Work client ID.
 * @param {string=} options.clientSecret Maps API for Work client secret (a.k.a.
 *     private key).
 * @param {string=} options.channel Maps API for Work channel.
 * @param {number=} options.timeout Timeout in milliseconds.
 *     (Default: 60 * 1000 ms)
 * @param {string=} options.language Default language for all queries.
 * @param {number=} options.rate.limit Controls rate-limiting of requests.
 *     Maximum number of requests per period. (Default: 50)
 * @param {number=} options.rate.period Period for rate limit, in milliseconds.
 *     (Default: 1000 ms)
 * @param {number=} options.retryOptions.interval If a transient server error
 *     occurs, how long to wait before retrying the request, in milliseconds.
 *     (Default: 500 ms)
 * @param {Function=} options.Promise - Promise constructor (optional).
 * @return {DistanceMatrixAiClient} The client object containing all API methods.
 */
exports.createClient = function (options) {
  options = options || {};

  if (options.experienceId && typeof options.experienceId === "string") {
    options.experienceId = [options.experienceId];
  }

  var makeApiCall = require("./internal/make-api-call").inject(options);
  var deprecate = require("util").deprecate;

  var makeApiMethod = function (apiConfig) {
    return function (query, callback, customParams) {
      query = apiConfig.validator(query);
      query.supportsClientId = apiConfig.supportsClientId !== false;
      query.options = apiConfig.options;
      if (options.language && !query.language) {
        query.language = options.language;
      }
      // Merge query and customParams.
      var finalQuery = {};
      customParams = customParams || {};
      [query, customParams].map(function (obj) {
        Object.keys(obj)
          .sort()
          .map(function (key) {
            finalQuery[key] = obj[key];
          });
      });
      return makeApiCall(apiConfig.url, finalQuery, callback);
    };
  };

  var distanceMatrix = require("./apis/distance-matrix");

  return {
    distanceMatrix: makeApiMethod(distanceMatrix.distanceMatrix),
    setExperienceId: (...ids) => {
      if (typeof ids === "string") {
        ids = [ids];
      }
      options.experienceId = ids;
    },
    getExperienceId: _ => options.experienceId,
    clearExperienceId: _ => {
      options.experienceId = null;
    }
  };
};

exports.cli = require("./internal/cli");
exports.util = require("./util");
