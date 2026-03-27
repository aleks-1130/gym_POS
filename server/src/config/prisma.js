const { PrismaClient } = require('@prisma/client');

const prismaClient = new PrismaClient();

const globalModels = ['Member', 'Coupon', 'PromoCode', 'Product', 'Plan', 'Category', 'ServiceBundle', 'ClassSessionPackage'];
const noGymModels = ['MemberBundleBucket', 'ServiceBundleUsage', 'ServiceBundleBucket']; // Models that don't have gymId

const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = require('../utils/context').gymContext.getStore();
        const gymId = context?.gymId;
        const tenantId = context?.tenantId;
        const userRole = context?.role;
        
        // Skip filtering for Tenant and Gym models, or if no gymId is in context, or if model doesn't have gymId
        if (!gymId || model === 'Tenant' || model === 'Gym' || noGymModels.includes(model)) {
          return query(args);
        }

        const isGlobalModel = globalModels.includes(model);

        // Apply gymId filter and auto-include for Product stock
        if (['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
          args.where = args.where || {}; // Ensure args.where is defined
          if (isGlobalModel) {
            const hasExplicitGlobalOr = args.where.OR?.some(cond => cond.isGlobal === true || cond.isGlobal?.equals === true);
            
            if (operation === 'findUnique' || hasExplicitGlobalOr) {
              // Skip automatic injection for findUnique or if the query already handles global visibility
            } else if (tenantId) {
              args.where = { ...args.where, tenantId: tenantId };
            } else if (gymId) {
              args.where = { ...args.where, OR: [{ gymId }, { gymId: null }] };
            }
          } else if (gymId) {
            // Force gymId unless OWNER explicitly provides gymId in the query.
            const isOwnerOverride = userRole === 'OWNER' && Boolean(args.where.gymId);
            if (!isOwnerOverride) {
              args.where = { ...args.where, gymId };
            }
          }
        }

        // Apply gymId to write operations if not already present
        if (operation === 'create' || operation === 'createMany') {
          const processData = (data) => {
            // Handle global models (Coupon/PromoCode/Product/Plan/Category)
            if (isGlobalModel && (data.isGlobal || data.gymId === null)) {
              const newData = { ...data, gymId: null };
              delete newData.isGlobal;
              return newData;
            }

            if (operation === 'createMany') {
              return { ...data, gymId: data.gymId ?? gymId, tenantId: data.tenantId ?? tenantId };
            }

            // Check if there are any nested relations
            const hasRelation = Object.values(data).some(v => 
              v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)
            );

            // Prefer scalar IDs (tenantId, gymId) to avoid "Unknown argument" errors on models 
            // that don't support nested connects for these fields (e.g., Booking).
            // We only use nested connects if the data already contains other relations.
            let refinedData = { ...data };
            
            if (hasRelation) {
                if (tenantId && !data.tenant && !data.tenantId) {
                    refinedData.tenant = { connect: { id: tenantId } };
                }
                if (gymId && !data.gym && !data.gymId) {
                    refinedData.gym = { connect: { id: gymId } };
                }
            } else {
                if (tenantId && !data.tenant && !data.tenantId) {
                    refinedData.tenantId = tenantId;
                }
                if (gymId && !data.gym && !data.gymId) {
                    refinedData.gymId = data.gymId ?? gymId;
                }
            }
            return refinedData;
          };

          if (Array.isArray(args.data)) {
            args.data = args.data.map(processData);
          } else {
            args.data = processData(args.data);
          }
        }

        // For updates and deletes, ensure they are scoped to the gym
        if (['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(operation)) {
            if (isGlobalModel) {
              if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
                return query(args);
              }
              if (tenantId) {
                args.where = { ...args.where, tenantId: tenantId };
              } else {
                args.where = { ...args.where, OR: [{ gymId }, { gymId: null }] };
              }
            } else if (gymId) {
             // Force gymId unless OWNER explicitly provides gymId in the query.
             const isOwnerOverride = userRole === 'OWNER' && Boolean(args.where.gymId);
             if (!isOwnerOverride) {
                args.where = { ...args.where, gymId };
             }
           }
        }

        const result = await query(args);
        if (model === 'ServiceBundle' || model === 'ClassSessionPackage' || model === 'Plan') {
          console.log(`[PRISMA DEBUG] ${model}.${operation} where:`, JSON.stringify(args.where, null, 2));
          console.log(`[PRISMA DEBUG] ${model}.${operation} result:`, Array.isArray(result) ? result.length : (result ? 1 : 0));
        }
        return result;
      },
    },
  },
});

module.exports = prisma;
