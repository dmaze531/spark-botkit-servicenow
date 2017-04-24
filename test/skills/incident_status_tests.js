const sinon = require('sinon');
const expect = require('chai').expect;
const incidentStatus = require('../../src/skills/incident_status.js');
const serviceNowClient = require('../../src/service_now_client.js');

describe('incident status', () => {
  const controller = { hears: sinon.spy() };

  beforeEach(() => {
    incidentStatus(controller);
  });

  it('should register hear listener on controller', () => {
    expect(controller.hears.calledOnce).to.be.true;
    expect(controller.hears.args[0][0]).to.deep.equal(['incident status (.*)']);
    expect(controller.hears.args[0][1]).to.equal('direct_message,direct_mention');
    expect(controller.hears.args[0][2]).to.be.a('function');
  });

  describe('listener callback', () => {
    let bot;
    let listenerCallback;
    beforeEach(() => {
      bot = { reply: sinon.spy() };
      listenerCallback = controller.hears.args[0][2];

      sinon.stub(serviceNowClient, 'getTableRecord').returns({
        then: () => Promise.resolve(),
        catch: () => Promise.reject(),
      });
    });

    afterEach(() => {
      serviceNowClient.getTableRecord.restore();
    });

    it('should look up incident record based on user supplied id', () => {
      const message = { match: 'incident status someSysId'.match(/incident status (.*)/) };

      listenerCallback(bot, message);

      expect(serviceNowClient.getTableRecord.calledOnce).to.be.true;
      expect(serviceNowClient.getTableRecord.args[0][0]).to.equal('incident');
      expect(serviceNowClient.getTableRecord.args[0][1]).to.equal('someSysId');
    });

    it('should reply with incident when record is found', () => {
      process.env.serviceNowBaseUrl = 'yo.service-now.com';
      const tableRecordPromise = Promise.resolve({ short_description: 'description for record 1234' });
      const message = { match: 'incident status 1234'.match(/incident status (.*)/) };

      serviceNowClient.getTableRecord.withArgs('incident', '1234').returns(tableRecordPromise);

      return listenerCallback(bot, message)
        .then(() => {
          expect(bot.reply.calledOnce).to.be.true;
          expect(bot.reply.args[0][0]).to.equal(message);
          expect(bot.reply.args[0][1]).to.equal('Information for incident: [1234](yo.service-now.com/incident.do?sys_id=1234)\n```{\n  "short_description": "description for record 1234"\n}');
        });
    });

    it('should reply with not found if incident cannot be found', () => {
      const tableRecordPromise = Promise.reject('Bad things');
      const message = { match: 'incident status asdasd'.match(/incident status (.*)/) };

      serviceNowClient.getTableRecord.withArgs('incident', 'asdasd').returns(tableRecordPromise);

      return listenerCallback(bot, message)
        .then(() => {
          expect(bot.reply.calledOnce).to.be.true;
          expect(bot.reply.args[0][0]).to.equal(message);
          expect(bot.reply.args[0][1]).to.equal('Sorry, I was unable to retrieve your incident: asdasd. Bad things');
        });
    });
  });
});
