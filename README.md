A general-purpose mixin architecture for apps and frameworks
============================================================

The Composable class provides your JavaScript framework or application with a
flexible mixin architecture. Composable takes the form of a general-purpose
factory for composing classes and objects with mixins. You can configure its
behavior through *composition rules*: functions that run at class creation time
to resolve conflicts in property or method names. This architecture lets you
achieve a good separation of concerns, and address scenarios which are difficult
to solve with classical inheritance.

Features:

1. Focuses exclusively on composing behavior, independent of any particular
   framework. Composable can be used in a wide variety of situations.
2. Leverages the JavaScript prototype chain as a unifying data structure. This
   provides a solid basis for explaining how mixins are composed together, and
   takes advantage of native language features.
3. Supports both implicit and and explicit means of resolving conflicts in
   property and method names. Implicit resolutions provide good default
   behavior, and explicit resolutions let you accommodate novel situations.
4. Designed with forthcoming JavaScript features in mind, including class and
   super keywords in ES6 and decorators in ES7. All features are also available
   in plain ES5.


Issues that come up with mixins
-------------------------------

Many JavaScript frameworks include a mixin feature in their class factory, but
the behavior of the resulting composed class varies from framework to framework.
A critical question is how the framework resolves conflicts in the names of
properties or methods supplied by mixins. Consider how a typical framework might
create a class with mixins:


    let mixin1 = {
      foo() {
        // Do mixin 1 work here...
        return "mixin1";
      }
    };
    let mixin2 = {
      foo() {
        // Do mixin2 work here...
        return "mixin2";
      }
    };
    let MyClass = TypicalFramework.createClass({
      foo() {
        // Do base class work here...
        return "MyClass";
      }
      mixins: [mixin1, mixin2]
    });

    let instance = new MyClass();
    instance.foo(); // Returns... what? And what work got performed?


Depending on the framework, the invocation of `instance.foo()` might invoke all
the `foo` implementations, or perhaps just one. If it just invokes one, that
might be `mixin2.foo()`, because that was the "last writer", or it might be
`MyClass.foo()`, because that's the base class and perhaps more important. We
have to wonder not only about what work will be performed, but also about what
result will be returned. The answer will vary from framework to framework. The
answer may also depend on the specific *name* of the method in conflict. Some
frameworks apply one conflict-resolution strategy to methods with special names,
and a different strategy to other methods.

Another thing we have to wonder about here is what other side effects this
framework's `createClass()` factory performs. Most frameworks will do work in
such a method beyond just applying mixins. That black-box approach makes class
creation feel magic, hampers understanding, and may complicate debugging.


Simple example using Composable
-------------------------------

The Composable class attempts to address the above issues with mixins. A very
basic example:


    class MyClass {
      foo() { return "MyClass"; }
    }

    let mixin = {
      foo() { return "mixin"; }
    };

    let MyClassWithMixin = Composable.compose.call(MyClass, mixin);
    let instance = new MyClassWithMixin();

    // By default, composed methods are invoked base first, then mixin.
    instance.foo(); // Returns "mixin"


The `Composable.compose` method does nothing but compose behavior — it has no
side effects, it does not destructively modify any classes. It just returns a
new class with the desired behavior. It has no relation to any specific
framework, and in fact this approach could be made to work with many frameworks.

The `compose` method works by extending a JavaScript prototype chain with
a copy of the given mixin(s). In this case, `compose` creates the chain:


    instance --> MyClassWithMixin (mixin copy) --> MyClass --> Object


The original base MyClass is left untouched.


Bases and mixins can be objects or classes
------------------------------------------

Before diving into the details of how Composable works, it's worth pointing out
that Composable works with any prototype chain. The starting point you give
`compose` can be either a base class or a plain object. Similarly, the mixin(s)
you give `compose` can be classes or objects.

So the above example could also have been written:


    class MyClass {
      ...
    }

    class Mixin {
      ...
    }

    let MyClassWithMixin = Composable.compose.call(MyClass, Mixin);


The only thing that's special about composing classes vs objects comes up
if you ask `compose` to compose a base class with a mixin class. In that case,
`compose` will not only extend the prototype chain as described above, but it
will also copy any static methods on the mixin class to the new subclass.

The remainder of this documentation will define mixins as classes, but whether
you decide to do that is a matter of taste. One advantage of defining mixins as
classes is that it makes the mixin a first-class object. You could, for example,
use `new Mixin()` to instantiate the mixin class and get a new object.


Composition rules
=================

In the above example, Composable resolved a conflict between a mixin and base
class method that both had the name `foo`. To do this, Composable applied a
default rule for resolving such a conflict. Let's look at how this rule was
applied, and how you can configure Composable's behavior for different
situations.


The key moment: adding a prototype to the prototype chain
---------------------------------------------------------

The Composable class does its critical work at the moment it adds a new mixin
to a prototype chain. In the example above, at the point a copy of `mixin` is
added to the chain, there are two `foo()` methods along the chain:


    MyClassWithMixin -->  MyClass       --> Object
    Mixin.foo()           MyClass.foo()


We can generalize this to say that Composable is considering the pivotal moment
when a new prototype is being added at the head of a prototype chain.


    New prototype at      Existing prototype chain becomes
    head of chain:        the tail of the new chain:

    Mixin -->             Base1 --> Base2 --> Base3 --> ... --> Object
    foo()                           foo()


At this moment, Composable inspects all the properties on the head of the chain
(that is, on the mixin being composed in). For each property it finds (like
`foo`), Composable looks at the chain's tail to see if there's a identically-named
property anywhere along it. The exact point along the tail where the property
like is immaterial. What matters is that, if a property with the same name
exists along the tail of the chain, the mixin's implementation at the head of
the prototype chain will obscure that base implementation. Sometimes that's
acceptable, but with mixins, that is often not the desired outcome.


Composition rules
-----------------

Rather than applying a hard-coded conflict resolution, Composable applies
developer-configured and default *composition rules* to resolve the conflict. If
no custom composition rules are in effect, the default rule will be to compose
the two `foo()` methods together using a rule called `baseMethodFirst`:


  MyClassWithMixin -->    MyClass       --> Object
  composed foo()          MyClass.foo()
    calls MyClass.foo()
    then  Mixin.foo()


Calling `foo()` on an instance of MyClassWithMixin will invoke the composed
`foo()` function. As its name implies, the `baseMethodFirst` rule will invoke
the base `MyClass.foo()` implementation first, then the `mixin.foo()`
implementation, and finally return the result of the latter.

The `baseMethodFirst` rule is Composable's default composition rule for
resolving method name conflicts, but other rules are available, and new ones can
be created.


Standard composition rules
--------------------------

The standard composition rules are:

* `baseMethodFirst`: Invokes the base method first, then invokes the mixin
  method, and return the mixin's result as the overall result. This is the
  default rule for methods discussed above.

* `baseSetterFirst`: This is the default rule for composing getter/setter
  properties. For getters, the mixin's getter will override the base getter (as
  usual in JavaScript). For setters, the base setter will be invoked first, then
  the mixin's setter.

* `chainPrototypes`. This is used to compose object-valued properties. This
  rule sets the prototype of the *object* value of the mixin property to point
  to the object value of the base property. The effect of this is to perform a
  shallow merge of the two objects, without copying over values.

* `override`: The mixin's implementation overrides the base implementation.
  This is the standard JavaScript behavior for all object members. For classes
  created with Composable, this is the default behavior only for scalar- or
  plain object-valued properties.

* `preferBaseResult`: This rule invokes the base method first. If that returns
  a truthy value, that is returned immediately. Otherwise, the mixin method is
  invoked, and its result is returned.

* `preferMixinResult`: The converse of the above rule. This rule invokes the
  mixin method first. If that returns a truthy value, that is returned
  immediately. Otherwise, the base method is invoked, and its result is
  returned.

You can define other rules for your application or framework, as discussed
further on.


Specifying composition rules with ES7 decorators
------------------------------------------------

One concise way to describe and think about specifying composition rules is
with ES7 decorators. These are still being finalized, but the core idea is
that annotations on object methods and properties can cause functions called
decorators to run. These are able to retroactively edit the definition for
the property or method in question.

While decorators are not, at the point this is being written, a standard
JavaScript feature, they nevertheless provide a good way of thinking about
how you can specify a composition rule. Using decorators, you can override
Composable's default composition rules.

For example, if you have a mixin that wants to defer to a base implementation
*if one exists*, you could write:


    class MyClass {
      get foo() { return this._foo; }
      set foo(value) { this._foo = value; }
    }

    class Mixin {
      // Provide a default value for the foo property.
      @Composable.rule(Composable.rules.preferBaseResult)
      foo() { return "Mixin"; }
    }

    let MyClassWithMixin = Composable.compose.call(MyClass, Mixin);

    let instance = new MyClassWithMixin();
    instance.foo // Returns "Mixin", since base value is undefined

    instance.foo = "Hello";
    instance.foo // Returns "Hello", since base value is now defined


Because the `preferBaseResult` rule was specified with the `@Composable.rule`
decorator, the Composable class resolved the name conflict using that rule.
Why is that useful? Here, the base MyClass defines a property foo that may or
may not be set. The mixin wants to provide a default value for that property
that is only used if the property value is currently undefined.


Using decorators in ES6/5
-------------------------

Until the `@decorator` syntax is widely available, you can also use a helper
function provided to manually apply decorators:


    class Mixin {
      foo() { return "Mixin"; }
    }
    Composable.decorate.call(Mixin.prototype, {
      foo: Composable.rule(Composable.rules.preferBaseResult)
    });

This has the same effect as the applying the `@Composable.rule` decorator. (You
can use this general helper function to apply any function with the decorator
signature, not just composition rules.)


Rules are decorators (applied at class composition time)
--------------------------------------------------------

If you want to create your own composition rule, you simply need to define
a function that has the decorator signature:

    function decorator(target, key, descriptor) {
    }

where:

* `target` is the head of the prototype chain
* `key` is the name of the method both base and mixin share
* `descriptor` is the property descriptor for the method

For example, the implementation of `preferBaseResult` is

    // Standard rule: return base's result if truthy, otherwise mixin result.
    Composable.rules.preferBaseResult = (target, key, descriptor) => {
      let mixinImplementation = descriptor.value;
      let baseImplementation = Object.getPrototypeOf(target)[key];
      descriptor.value = function() {
        return baseImplementation.apply(this, arguments)
            || mixinImplementation.apply(this, arguments);
      }
    };


Manipulating prototype chains with Composable
=============================================

Because Composable works directly on JavaScript prototype chains, you
immediately get a great deal of flexibility in how you can use it. This
section presents a sampling of ideas to explore.


Creating inherently composable classes
--------------------------------------

If you anticipate people wanting to extend your classes with mixins, you can do
that in several ways. The simplest is to derive your base class from Composable:


    class MyBaseClass extends Composable {
      foo() { return "MyBaseClass"; }
    }

    class Mixin {
      foo() { return "Mixin"; }
    }

    let MyClass = MyBaseClass.compose(Mixin);

    let instance = new MyClass();
    instance.foo(); // returns "Mixin"


The prototype chain looks like this:


    instance --> MyClass --> MyBaseClass --> Composable --> Object


This means that MyBaseClass gains Composable's `compose` method. This allows
the more concise `MyBaseClass.compose()` syntax instead of the more verbose
`Composable.compose.call()` syntax.


Make anything composable
------------------------

Composable will happily mix anything into a prototype chain — including
*itself*. This is useful if you're working with a base class defined elsewhere
and can't (or don't want to) make that particular base class Composable.
Suppose you are working with a Thing class defined elsewhere, and you want to
create a variant of Thing with a `compose` method:


    import Thing from 'some/external/dependency.js';

    // Use Composable to add a copy of *itself* to a prototype chain.
    let ComposableThing = Composable.compose.call(Thing, Composable);

    // ComposableThing now embodies composable Thing objects.
    // You can now use that to compose new classes using mixins.
    class Mixin { ... }
    class ThingSubclass extends ComposableThing.compose(Mixin) {
      ...
    }


The resulting prototype chain looks like:


    ThingSubclass --> Mixin --> ComposableThing --> Thing --> Object


Redefining a class to include mixins
------------------------------------

In most of the above examples, the output of `compose` is exposed to the world.
For example, a class MyClass is composed with Mixin to create MyClassWithMixin.


    class MyClass extends Composable {
      foo() { return "MyClass"; }
    }
    class Mixin = {
      foo() { return "Mixin"; }
    }

    let MyClassWithMixin = MyClass.compose(Mixin);


But maybe you don't want expose both MyClass and MyClassWithMixin. It's easy
enough to redefine a class to include a mixin:


    class MyClass extends Composable {
      foo() { return "MyClass"; }
    }
    class Mixin = {
      foo() { return "Mixin"; }
    }

    MyClass = MyClass.compose(Mixin);

    let instance = new MyClass();
    instance.foo(); // Returns "Mixin"


This creates the prototype chain:


    instance --> MyClass (includes Mixin) --> (original MyClass) --> Object


Extending a base class composed with mixins
-------------------------------------------

The ES6 `class` syntax allows you to provide an *expression* as base class
for `extends`. Depending on what result you want to achieve, this can be
a concise way to compose mixins:


    class Mixin = {
      foo() { return "Mixin"; }
    }

    class MyClass extends Composable.compose(Mixin) {
      foo() { return "MyClass"; }
    }

    let instance = new MyClass();
    instance.foo(); // Returns "MyClass", because MyClass is at head of chain


Because the base class for `extends` is `Composable.compose(Mixin)`, we get
the following prototype chain:


    instance --> MyClass --> (copy of Mixin) --> Composable --> Object


Compared to the previous example, the positions of MyClass and Mixin are
reversed. This is because Mixin was composed into the starting point for
MyClass, rather than composed into MyClass afterwards.


Creating classes in ES5
-----------------------

Most of the examples in this document use ES6's `class` syntax, but you can
also use Composable as a general-purpose class factory in ES5:


    var mixin = {
      foo() { return "Mixin"; }
    }
    var MyClass = Composable.compose.call(Object, {
      foo() { return "MyClass" }
    }, Mixin);

    var instance = new MyClass();
    instance.foo() // Returns "Mixin"


Example: Applying mixins to HTML element classes
================================================

As one example of how you could use Composable to compose complex behaviors
from mixins, let's take a quick look at creating a custom HTML element using
Composable and the Custom Elements API.


    // Create a general-purpose element base class that supports composition.
    let ComposableElement = Composable.compose.call(HTMLElement, Composable);

    // A mixin that sets an element's text content.
    class HelloMixin {
      createdCallback() {
        this.textContent = "Hello, world!";
      }
    }

    // A sample element class that uses the above mixin.
    let HelloElement = ComposableElement.compose(HelloMixin);

    // Register the sample element class with the browser.
    document.registerElement('hello-element', HelloElement);

    // Create an instance of our new element class.
    let element = document.createElement('hello-element');
    document.body.appendChild(element); // "Hello, world!"


When we're done, we've constructed the following prototype chain:


    element -> HelloElement -> HelloMixin -> ComposableElement -> HTMLElement


So `element` is an instance of HelloElement composed of behaviors from
HTMLElement (so it can render), a ComposableElement (so mixins can be applied),
HelloMixin (to set its text content).
