/**
 * Standard composition rules
 */

/*
 * Take two functions and return a new composed function that invokes both.
 * The composed function will return the result of the second function.
 * This is not a rule, but a helper used by rules.
 */
export function composeFunction(function1, function2) {
  return function() {
    function1.apply(this, arguments);
    return function2.apply(this, arguments);
  };
}


/*
 * Combinator that sets the prototype of a mixin property value to be the
 * corresponding value on the base. This effectively does a shallow merge of
 * of the properties, without copying any information.
 */
export function chainPrototypes(target, key, descriptor) {
  let mixinValue = descriptor.value;
  let base = Object.getPrototypeOf(target);
  let baseDescriptor = getPropertyDescriptor(base, key);
  let baseValue = baseDescriptor.value;
  Object.setPrototypeOf(mixinValue, baseValue);
}


/*
 * Helper function to complete a property definition for a mixin.
 *
 * Default JavaScript behavior is that a subclass that defines a getter but not
 * a setter will never have the base class' setter invoked. Similarly, a
 * subclass that defines a setter but not a getter will never have the base
 * class' getter invoked.
 *
 * For mixins, we want the default behavior to be that, if a mixin only defines
 * a getter, but the base class defines a setter, we want the mixin to acquire
 * a default setter than invokes the base setter. Likewise, we want to define
 * a default getter if none is supplied.
 *
 * To carry that out, this helper function rounds out a property definition to
 * ensure it has a default getter or setter if it needs one.
 */
function completePropertyDefinition(descriptor, baseDescriptor) {
  if (descriptor.get && !descriptor.set && baseDescriptor.set) {
    // Mixin has getter but needs a default setter.
    let baseSetter = baseDescriptor.set;
    descriptor.set = function(value) {
      baseSetter.call(this, value);
    };
  }
  if (descriptor.set && !descriptor.get && baseDescriptor.get) {
    // Mixin has setter but needs a default getter.
    let baseGetter = baseDescriptor.get;
    descriptor.get = function() {
      return baseGetter.call(this);
    };
  }
}


/*
 * Perform a deep merge of a mixin property on top of a base property.
 */
// export function deepMerge(target, key, descriptor) {
//   let mixinValue = descriptor.value;
//   let baseValue = Object.getPrototypeOf(target)[key].value;
//   descriptor.value = 'merged'; // merge(baseValue, mixinValue);
// }

/*
 * Helper to return the base descriptor for the indicated key. This is used to
 * find the specific implementation that would otherwise be overridden by the
 * mixin.
 */
export function getBaseDescriptor(target, key) {
  let base = Object.getPrototypeOf(target);
  return getPropertyDescriptor(base, key);
}


/*
 * Like Object.getOwnPropertyDescriptor(), but walks up the prototype chain.
 * This is needed by composition rules, which usually start out by getting
 * the base implementation of a member they're composing.
 * This is not a rule, but a helper used by rules.
 */
export function getPropertyDescriptor(obj, name) {
  let descriptor = Object.getOwnPropertyDescriptor(obj, name);
  if (descriptor) {
    return descriptor;
  } else {
    let prototype = Object.getPrototypeOf(obj);
    // Checking for "name in prototype" lets us know whether we should bother
    // walking up the prototype chain.
    if (prototype && name in prototype) {
      return getPropertyDescriptor(prototype, name);
    }
  }
  return undefined; // Not found
}


/*
 * Combinator that causes a mixin method to override its base implementation.
 * Since this the default behavior of the prototype chain, this is a no-op.
 */
export function override(target, key, descriptor) {}


/*
 * Compose methods, invoking base implementation first. If it returns a
 * truthy result, that is returned immediately. Otherwise, the mixin
 * implementation's result is returned.
 */
export function preferBaseResult(target, key, descriptor) {
  let mixinImplementation = descriptor.value;
  let baseDescriptor = getBaseDescriptor(target, key);
  let baseImplementation = baseDescriptor.value;
  descriptor.value = function() {
    return baseImplementation.apply(this, arguments)
        || mixinImplementation.apply(this, arguments);
  };
}


/*
 * Like preferBaseResult, but for getter/setters. The base getter is invoked
 * first. If it returns a truthy result, that is returned. Otherwise, the mixin
 * getter's result is returned. Setter is invoked base first, then mixin.
 */
export function preferBaseGetter(target, key, descriptor) {
  let mixinGetter = descriptor.get;
  let mixinSetter = descriptor.set;
  let baseDescriptor = getBaseDescriptor(target, key);
  let baseGetter = baseDescriptor.get;
  let baseSetter = baseDescriptor.set;
  if (mixinGetter && baseGetter) {
    // Compose getters.
    descriptor.get = function() {
      return baseGetter.apply(this) || mixinGetter.apply(this);
    };
  }
  if (mixinSetter && baseSetter) {
    // Compose setters.
    descriptor.set = composeFunction(baseSetter, mixinSetter);
  }
  completePropertyDefinition(descriptor, baseDescriptor);
}


/*
 * Like preferMixinResult, but for getter/setters. The mixin getter is invoked
 * first. If it returns a truthy result, that is returned. Otherwise, the base
 * getter's result is returned. Setter is still invoked base first, then mixin.
 */
export function preferMixinGetter(target, key, descriptor) {
  let mixinGetter = descriptor.get;
  let mixinSetter = descriptor.set;
  let baseDescriptor = getBaseDescriptor(target, key);
  let baseGetter = baseDescriptor.get;
  let baseSetter = baseDescriptor.set;
  if (mixinGetter && baseGetter) {
    // Compose getters.
    descriptor.get = function() {
      return mixinGetter.apply(this) || baseGetter.apply(this);
    };
  }
  if (mixinSetter && baseSetter) {
    // Compose setters.
    descriptor.set = composeFunction(baseSetter, mixinSetter);
  }
  completePropertyDefinition(descriptor, baseDescriptor);
}


/*
 * Compose methods, invoking mixin implementation first. If it returns a truthy
 * result, that is returned immediately. Otherwise, the base implementation's
 * result is returned.
 */
export function preferMixinResult(target, key, descriptor) {
  let mixinImplementation = descriptor.value;
  let baseDescriptor = getBaseDescriptor(target, key);
  let baseImplementation = baseDescriptor.value;
  descriptor.value = function() {
    return mixinImplementation.apply(this, arguments)
        || baseImplementation.apply(this, arguments);
  }
}


/*
 * Default rule for composing methods: invoke base first, then mixin.
 */
export function baseMethodFirst(target, key, descriptor) {
  let mixinImplementation = descriptor.value;
  let baseDescriptor = getBaseDescriptor(target, key);
  let baseImplementation = baseDescriptor.value;
  descriptor.value = composeFunction(baseImplementation, mixinImplementation);
}


/*
 * Default rule for composing properties.
 * We only compose setters, which invoke base first, then mixin.
 * A defined mixin getter overrides a base getter.
 * Note that, because of the way property descriptors work, if the mixin only
 * defines a setter, but not a getter, we have to supply a default getter that
 * invokes the base getter. Similarly, if the mixin just defines a getter,
 * we have to supply a default setter.
 */
export function baseSetterFirst(target, key, descriptor) {
  let mixinSetter = descriptor.set;
  let baseDescriptor = getBaseDescriptor(target, key);
  let baseSetter = baseDescriptor.set;
  if (mixinSetter && baseSetter) {
    // Compose setters.
    descriptor.set = composeFunction(baseSetter, mixinSetter);
  }
  completePropertyDefinition(descriptor, baseDescriptor);
}
