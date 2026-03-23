const { PrismaClient } = require('@prisma/client');

const prismaClient = new PrismaClient();

const globalModels = ['Coupon', 'PromoCode', 'Product', 'Plan', 'Category'];

const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = require('../utils/context').gymContext.getStore();
        const gymId = context?.gymId;
        const userRole = context?.role;
        
        // Skip filtering for Tenant and Gym models, or if no gymId is in context
        if (!gymId || model === 'Tenant' || model === 'Gym') {
          return query(args);
        }

        const isGlobalModel = globalModels.includes(model);

        // Apply gymId filter and auto-include for Product stock
        if (['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
          args.where = args.where || {}; // Ensure args.where is defined
          if (isGlobalModel) {
            if (operation === 'findUnique') {
              // findUnique does not support OR. Skip injection to avoid Prisma error.
            } else {
              args.where = { ...args.where, OR: [{ gymId }, { gymId: null }] };
            }
          } else {
            // Force gymId UNLESS user is OWNER and already provided an explicit gymId or specific ID
            const isOwnerOverride = userRole === 'OWNER' && (args.where.gymId || args.where.id);
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
              return { ...data, gymId: data.gymId ?? gymId };
            }

            const hasRelation = Object.values(data).some(v => 
              v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)
            );

            if (hasRelation) {
              if (!data.gym && !data.gymId) {
                return { ...data, gym: { connect: { id: gymId } } };
              }
              return data;
            } else {
              return { ...data, gymId: data.gymId ?? gymId };
            }
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
             args.where = { ...args.where, OR: [{ gymId }, { gymId: null }] };
           } else {
             // Force gymId UNLESS user is OWNER and already provided an explicit gymId or specific ID
             const isOwnerOverride = userRole === 'OWNER' && (args.where.gymId || args.where.id);
             if (!isOwnerOverride) {
                args.where = { ...args.where, gymId };
             }
           }
        }

        return query(args);
      },
    },
  },
});

module.exports = prisma;
