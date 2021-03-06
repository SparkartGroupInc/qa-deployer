const HASHED_PASSWORD = 'c85424f7cd0a10756721672f11edb59e646dc83fd2a37b1ce6f6d01fb93fd94835e3779f36e6298bdeec027e14ed913b0f39e4e7bce7ed0d4f054edcc4d4dac2';

var assert = require('assert');
var nock = require('nock');
var sinon = require('sinon');

var modulus_cli = require('../../src/utils/modulus-cli.js');
var modulus = require('../../src/deployers/modulus.js');
var utils = require('../../src/utils/utils.js');

describe('deployers/modulus', function() {
  var options;
  var nocks;

  beforeEach(function() {
    options = {
      auth: {username: 'me', password: 'thePassword'},
      project: 'theProject',
      env: {
        TEST_VAR: 'testvalue'
      }
    };
    nocks = [];
    nock.disableNetConnect();
    this.sinon = sinon.sandbox.create();
  });

  afterEach(function() {
    nocks.forEach(function(item) {
      item.done();
    });
    nock.cleanAll();
    nock.enableNetConnect();
    this.sinon.restore();
  });

  describe('.init()', function() {
    it('initializes options.project', function(done) {
      var mock_utils = this.sinon.mock(utils);
      mock_utils.expects('cwdName').returns('some-project');

      assert.equal(modulus.init({}).options.project, 'some-project');
      done();
    });
  });

  describe('.deploy()', function() {
    it('deploys to a new project', function(done) {
      var mock_modulus_cli = this.sinon.mock(modulus_cli);

      // authenticateUser
      mock_modulus_cli.expects('command').withArgs(['login', '--username', 'me', '--password', 'thePassword']).yields();
      nocks.push(nock('https://api.onmodulus.net').post('/user/authenticate', {login: 'me', password: HASHED_PASSWORD}).reply(200, {id: 123, authToken: 'theToken'}));

      // createProjectIfMissing
      nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, []));
      nocks.push(nock('https://api.onmodulus.net').post('/project/create?authToken=theToken', {name: 'theProject', creator: 123}).reply(200, {name: 'theProject'}));

      // setEnvironmentVariables
      mock_modulus_cli.expects('command').withArgs(['env', 'set', 'TEST_VAR', 'testvalue', '-p', 'theProject']).yields();

      // deployProject
      mock_modulus_cli.expects('command').withArgs(['deploy', '-p', 'theProject']).yields();
      nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, [{name: 'theProject', domain: 'review/url'}]));

      modulus.init(options).deploy(function(redeploy, review_url) {
        assert(!redeploy);
        assert.equal(review_url, 'http://review/url');
        done();
      });
    });

    it('deploys to an existing project', function(done) {
      var mock_modulus_cli = this.sinon.mock(modulus_cli);

      // authenticateUser
      mock_modulus_cli.expects('command').withArgs(['login', '--username', 'me', '--password', 'thePassword']).yields();
      nocks.push(nock('https://api.onmodulus.net').post('/user/authenticate', {login: 'me', password: HASHED_PASSWORD}).reply(200, {id: 123, authToken: 'theToken'}));

      // createProjectIfMissing
      nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, [{name: 'theProject'}]));

      // setEnvironmentVariables
      mock_modulus_cli.expects('command').withArgs(['env', 'set', 'TEST_VAR', 'testvalue', '-p', 'theProject']).yields();

      // deployProject
      mock_modulus_cli.expects('command').withArgs(['deploy', '-p', 'theProject']).yields();
      nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, [{name: 'theProject', domain: 'review/url'}]));

      modulus.init(options).deploy(function(redeploy, review_url) {
        assert(redeploy);
        assert.equal(review_url, 'http://review/url');
        done();
      });
    });
  });

  describe('.withdraw()', function() {
    it('deletes an existing project', function(done) {
      var mock_modulus_cli = this.sinon.mock(modulus_cli);

      // authenticateUser
      mock_modulus_cli.expects('command').withArgs(['login', '--username', 'me', '--password', 'thePassword']).yields();
      nocks.push(nock('https://api.onmodulus.net').post('/user/authenticate', {login: 'me', password: HASHED_PASSWORD}).reply(200, {id: 123, authToken: 'theToken'}));

      // deleteProject
      nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, [{name: 'theProject', id: 54321}]));
      mock_modulus_cli.expects('command').withArgs(['project', 'delete', '-p', 'theProject']).yields();

      modulus.init(options).withdraw(function() {
        done();
      });
    });

    it('does not delete a non-existing project', function(done) {
      var mock_modulus_cli = this.sinon.mock(modulus_cli);

      // authenticateUser
      mock_modulus_cli.expects('command').withArgs(['login', '--username', 'me', '--password', 'thePassword']).yields();
      nocks.push(nock('https://api.onmodulus.net').post('/user/authenticate', {login: 'me', password: HASHED_PASSWORD}).reply(200, {id: 123, authToken: 'theToken'}));

      // deleteProject
      nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, []));

      modulus.init(options).withdraw(function() {
        done();
      });
    });

    describe('with multiple projects', function() {
      beforeEach(function() {
        options.projects = ['theProject1', 'theProject2', 'theProject3'];
      });

      it('deletes matching projects', function(done) {
        var mock_modulus_cli = this.sinon.mock(modulus_cli);

        // authenticateUser
        mock_modulus_cli.expects('command').withArgs(['login', '--username', 'me', '--password', 'thePassword']).yields();
        nocks.push(nock('https://api.onmodulus.net').post('/user/authenticate', {login: 'me', password: HASHED_PASSWORD}).reply(200, {id: 123, authToken: 'theToken'}));

        // deleteProjects
        var existing_projects = [
          {name: 'theProject1', id: 54321},
          {name: 'theProject2', id: 65432},
          {name: 'theProject4', id: 76543}
        ];
        nocks.push(nock('https://api.onmodulus.net').get('/user/123/projects?authToken=theToken').reply(200, existing_projects));
        mock_modulus_cli.expects('command').withArgs(['project', 'delete', '-p', 'theProject1']).yields();
        mock_modulus_cli.expects('command').withArgs(['project', 'delete', '-p', 'theProject2']).yields();

        modulus.init(options).withdraw(function() {
          done();
        });
      });
    });
  });
});
