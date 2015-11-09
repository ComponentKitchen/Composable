/**
 * Standard composition rules
 */

// Take two functions and return a new composed function that invokes both.
// The composed function will return the result of the second function.
// This is not a rule, but a helper used by rules.
export function composeFunction(function1, function2) {
  return function() {
    function1.apply(this, arguments);
    return function2.apply(this, arguments);
  };
}

// Like Object.getOwnPropertyDescriptor(), but walks up the prototype chain.
// This is needed by composition rules, which usually start out by getting
// the base implementation of a member they're composing.
// This is not a rule, but a helper used by rules.
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

// Combinator that causes a mixin method to override its base implementation.
// Since this the default behavior of the prototype chain, this is a no-op.
export function override(target, key, descriptor) {}

// Compose methods, invoking base implementation first. If it returns a
// truthy result, that is returned. Otherwise, the mixin implementation's
// result is returned.
export function preferBaseResult(target, key, descriptor) {
  let mixinImplementation = descriptor.value;
  let baseImplementation = Object.getPrototypeOf(target)[key];
  descriptor.value = function() {
    return baseImplementation.apply(this, arguments)
        || mixinImplementation.apply(this, arguments);
  }
}

// Compose methods, invoking mixin implementation first. If it returns a
// truthy result, that is returned. Otherwise, the base implementation's
// result is returned.
export function preferMixinResult(target, key, descriptor) {
  let mixinImplementation = descriptor.value;
  let baseImplementation = Object.getPrototypeOf(target)[key];
  descriptor.value = function() {
    return mixinImplementation.apply(this, arguments)
        || baseImplementation.apply(this, arguments);
  }
}

// Default rule for composing methods: invoke base first, then mixin.
export function propagateFunction(target, key, descriptor) {
  let mixinImplementation = descriptor.value;
  let baseImplementation = Object.getPrototypeOf(target)[key];
  descriptor.value = composeFunction(baseImplementation, mixinImplementation);
}

// Default rule for composing properties.
// We only compose setters, which invoke base first, then mixin.
// A defined mixin getter overrides a base getter.
// Note that, because of the way property descriptors work, if the mixin only
// defines a setter, but not a getter, we have to supply a default getter that
// invokes the base getter. Similarly, if the mixin just defines a getter,
// we have to supply a default setter.
export function propagateProperty(target, key, descriptor) {
  let base = Object.getPrototypeOf(target);
  let baseDescriptor = getPropertyDescriptor(base, key);
  if (descriptor.get && !descriptor.set && baseDescriptor.set) {
    // Need to supply default setter.
    descriptor.set = function(value) {
      baseDescriptor.set.call(this, value);
    };
  } else if (descriptor.set) {
    if (!descriptor.get && baseDescriptor.get) {
      // Need to supply default getter.
      descriptor.get = function() {
        return baseDescriptor.get.call(this);
      };
    }
    // Compose setters.
    descriptor.set = composeFunction(baseDescriptor.set, descriptor.set);
  }
}
