const { AsyncLocalStorage } = require('async_hooks');

const gymContext = new AsyncLocalStorage();

module.exports = {
  gymContext,
  getGymId: () => gymContext.getStore()?.gymId,
  getRole: () => gymContext.getStore()?.role,
  runWithContext: ({ gymId, role, tenantId }, callback) => 
    gymContext.run({ gymId, role, tenantId }, callback)
};
