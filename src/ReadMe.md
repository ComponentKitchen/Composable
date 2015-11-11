

Example
-------
A typical example using the Composable class looks like this:

    class Mixin {
      foo() {
        return "Hello, world.";
      }
    }
    class Base extends Composable {}
    Base = Base.compose(Mixin);

    let instance = new Base();
    instance.foo() // "Hello, world."

Here, the Base class has been extended with a `foo()` method, so that method is
available to all instances of Base.

The remainder of this document walks through the motivation for this system and
explores typical usage.


Mixins
======

Many JavaScript frameworks have class factories that support mixins. Some
frameworks define behavior exclusively with mixins, eschewing anything that
looks like traditional single-inheritance classes. Other frameworks use mixins
to augment class creation.

While implementations vary, mixins are generally defined in JavaScript as
objects supplied to a factory method that creates classes. Let's consider the
use of mixins in a hypothetical JavaScript framework called FrameworkDuJour:

    let mixin = {
      foo: "mixin"
    };
    let Base = FrameworkDuJour.classFactory({
      mixins: [mixin]
    });

    let instance = new Base();
    instance.foo // "mixin"

Typically, the classFactory() method copies the members of the mixin to the
prototype of the class being created. This makes the mixin's members available
to all new instances of the resulting class. Multiple mixins can be applied to
the same class.

These features can make mixins a convenient way for you to factor behavior,
letting you compose behaviors to create the final classes you want. Because
mixin properties and methods are generally flattened into the prototype of the
class you're creating, they can be memory-efficient and performant.

That said, there are some disadvantages to mixins like this:

1. The Base class above feels like a first-class construct, while the mixin
feels second class. It can't be instantitated on its own, for example.
2. The use of the custom classFactory() method is idiosyncratic to this
particular framework. A developer looking at the above code can't know what how
the "mixins" key is going to affect the resulting class unless it knows more
about FrameworkDuJour.
3. Although we might assume that classFactory() is following common JavaScript
conventions for classes, we don't know that for sure. We might, for example,
assume that classFactory() is establishing a JavaScript prototype chain whose
behavior is governed by the language itself. We might assume that we can
instantiate Base with `new Base()`. But if we're unfamiliar with
FrameworkDuJour, we can't be sure how to work with Base, or how Base objects
will behave.


Mixin conflict resolution
-------------------------
A critical question is how to resolve conflicts in the names of mixin members.
For example, a mixin may declare a method of the same name as the target class
whose prototype is being modified, or multiple mixins applied to a target may
share methods of the same name.

    let mixin1 = {
      foo() { return "mixin1"; }
    };
    let mixin2 = {
      foo() { return "mixin2"; }
    }
    let Base = FrameworkDuJour.classFactory({
      foo() { return "Base"; }
      mixins: [mixin1, mixin2]
    });

    let instance = new Base();
    instance.foo() // What does this return?

A common and simple solution to resolving name conflicts is "last writer wins".
Generally this is interpreted to mean that mixin methods overwrite methods on
the target, and that mixins are applied in the order they are specified.
Following this "last writer wins" approach, in the above case we *probably*
see mixin2's implementation win, because it was specified last:

    instance.foo() // "mixin2"

However, the exact behavior may vary from framework to framework.

Moreover, there are many cases where it is desirable to let mixins *augment*
behavior, not override it. Here, "last writer wins" is insufficient. Frameworks
that want to support these situations may resolve name conflicts by invoking
all method implementations on the base class and any mixins applied to it:

    let mixin1 = {
      foo() { console.log("mixin1"); }
    };
    let mixin2 = {
      foo() { console.log("mixin2"); }
    }
    let Base = FrameworkDuJour.classFactory({
      foo() { console.log("Base"); }
      mixins: [mixin1, mixin2]
    });

    let instance = new Base();
    instance.foo() // Writes "Base", "mixin1", "mixin2"... but in what order?

Again, the idiosyncratic nature of mixin implementations means we can't
reason about aggregate behavior without knowing more about FrameworkDuJour.
* Some frameworks will invoke Base.foo() first, then the mixin foo()
implementations. Other frameworks will do the opposite: invoke mixins first,
then the Base implementation.
* Most frameworks will invoke mixin1.foo() before
mixin2.foo(), because they were specified in that order, but again that behavior
isn't guaranteed to be consistent across frameworks.
* The precise aggregation behavior may even vary within a single framework.
Component frameworks like React and Polymer both treat certain "lifecycle
methods" specially: if multiple mixins implement a given lifecycle method, the
functions are composed. At those points in the component lifecycle, all the
mixin behaviors will apply. But other methods — those without the special
lifecycle names — are treated as "last writer wins".

All this complexity makes it hard to learn the specifics of a given framework,
let alone work effectively with multiple frameworks in the same codebase.


JavaScript already has an extension mechanism: the prototype chain
==================================================================

JavaScript already provides a native means of aggregating
behavior through the language's prototype chain, a simple linked list of
object prototypes. If multiple prototypes on the chain implement a method of the
same name, the order of the linked list resolves the name conflict: the first
prototype in the chain that implements the method wins. (If you're unfamiliar
with the prototype chain, many articles on the web cover the topic in depth. A
reasonable starting point is MDN's article on
[Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain?redirectlocale=en-US&redirectslug=JavaScript%2FGuide%2FInheritance_and_the_prototype_chain).)

This prototype chain is a language feature, and its behavior is definitively
unambiguous. All JavaScript implementations are required to treat the prototype
chain exactly the same. To many people, in fact, the prototypal nature of
JavaScript is the language's defining characteristic.

We can use the prototype chain as the basis for a mixin solution whose
conflict resolution strategy is both clearly defined and flexible. Instead of
copying mixin members into a target base class prototype, we can just extend
the prototype chain to include those mixins.


    obj --> ExtendedBase (mixin2) --> mixin1 --> Base --> Object



Using the prototype chain this way does create more objects than simply
flattening mixins into a single class' prototype. But any mixin approach that
wants to go beyond "last writer wins" and allow a single method call to invoke
implementations defined by mulitple methods/classes will also need to create
more objects (composed functions, array lists of which mixins implement which
methods, etc., depending on the framework). Such proprietary solutions are not
necessarily more efficient than using the prototype chain. In fact, there's
every reason to trust that JavaScript engine implementors have gone to great
lengths to ensure that use of the prototype chain is highly efficient.

Leveraging a prototype chain which is part of the JavaScript language provides
additional advantages:

* The behavior of the prototype chain is well-documented in an endless number
  of JavaScript books, tutorials, blog posts, etc.
* A constructed prototype chain allows us to reason about object behaviors
  (e.g., in the debugger), even if don't know anything about the code that
  assembled that prototype chain.
* The prototype chain will be directly supported in JavaScript forever, even as
  the language evolves. E.g., ES6 classes codify a convention for manipulating
  the prototype chain.


The Composable class
====================

The Composable class embodies the prototype chain approach to mixins which is
sketched out above in a class that can be used either as a helper, or as a base
class for creating composable classes.


Extending any class with a mixin object
---------------------------------------
In its simplest form, we can use the Composable class' `compose()` method to
extend a class in exactly the way described above:

    let mixin = {
      foo() { return "mixin"; }
    };
    class Base {
      foo() { return "Base"; }
    }
    Base = Composable.compose.call(Base, mixin);

    let obj = new Base();
    obj.foo(); // "mixin"

The call to `Composable.compose()` just adds mixin to the head of the prototype
chain. The reference Base is then updated to point to the new head of the chain.
This is simply codifying the pattern described above.

The use of `Composable.compose()` here is, of course, only slightly less
idiosyncratic than the use of something like `FrameworkDuJour.classFactory()`.
That said, the Composable class is actually doing very little — it's just
extending a prototype chain. No other framework magic is going on. That's more
than can be said of many frameworks, where the class factory may not only
perform considerable magic, it may produce an object with proprietary internal
data structures and behavior.


Creating composable, mixin-ready classes
----------------------------------------
If you anticipate people wanting to extend your classes with mixins, you can do
that in several ways. The simplest is to derive your class from Composable:

    let mixin = {
      foo() { return "mixin"; }
    }
    class Base extends Composable {}
    Base = Base.compose(mixin);

which produces the same result as above. Multiple mixins can be supplied to
`compose()`:

    let mixin1 = { foo: "mixin1" };
    let mixin2 = { foo: "mixin2" };
    let mixin3 = { foo: "mixin3" };
    class Base extends Composable {}
    Base = Base.compose(mixin1, mixin2, mixin3);

    let obj = new Base();
    obj.foo; // "mixin3"

The `compose()` function applies mixins to the head of the prototype chain in
order, so mixin3 ends up at the head of the chain. This is equivalent to:

    Base = Base.compose(mixin1).compose(mixin2).compose(mixin3);

Hence, it's mixin3's value of `foo` that's returned.

Classes created by extending Composable inherit the ability to be extended
themselves.


Extending with classes, not just objects
----------------------------------------
Mixins are typically plain JavaScript objects, but Composable's `compose()`
method can take classes as arguments:

    class Mixin {
      foo() { return "foo"; }
      static bar() { return "bar"; }
    }
    class Base extends Composable {}
    Base = Base.compose(Mixin);

    let obj = new Base();
    obj.foo(); // "foo"
    Base.bar(); // "bar"

It's a matter of taste whether to define mixins as plain objects or classes.
Being able to compose classes into the prototype chain can open up new
opportunities:

* A mixin defined as a class is a first-class construct, and can be instantiated
  directly with `new()`.
* ES6 supplies a `class` syntax. It's a matter of opinion, but use of
  `class` may send a stronger signal about the author's intention to readers of
  the code. Specifically, a class suggests that the code embodies a
  self-contained package of behavior.
* A class can provide both static and instance members. The `compose()` method
  will include *both* when creating the extended class. Static members are
  handled as "last writer wins": base static class members are copied first,
  then mixin static class members in the order they're supplied.
* It's possible to create a non-trivial class hierarchy for *mixins*. When
  Composable applies a mixin class as an extension, the members are copied from
  the mixin's overall prototype chain (not including Function or Object).


Making existing classes Composable
----------------------------------
Interestingly, you can use the Composable class to apply *itself* as a mixin.
This is useful if you're working with a base class defined elsewhere and can't
(or don't want to) make that particular base class Composable. You can create
an Composable subclass of that base class by supplying Composable itself as an
argument to its own `compose()` method:

    import Thing from 'some/external/dependency.js';
    let ComposableThing = Composable.extend.call(Thing, Composable);

    // ComposableThing now embodies Composable Thing objects.
    class Mixin { ... }
    let SpecialThing = ComposableThing.compose(Mixin);



    class ThingSubclass extends ComposableThing.compose(Mixin) {
      ...
    }



Composition vs inheritance
==========================

The presence of a `class` keyword or `class A extends B` syntax in these
examples might be taken as an indication of classical single inheritance. That
might be problem for people who believe that composition of behavior (such as
mixins) is superior to classical inheritance. Such people may feel that
inheritance leads to complex, brittle systems. Whether or not that claim is
true, it's important to note that what's going on in the examples above is not
classical single inheritance.

People from backgrounds in traditional class-oriented languages think of
JavaScript's prototype chain as synonymous with inheritance, but that's just one
way to conceptualize JavaScript. The prototype chain is just a dynamic linked
list -- how you want to use it is up to you.

In this case, we're using the prototype chain, not to implement classical
inheritance, but to compose behaviors in arbitrary combinations and orders.
Among other things, this means we can apply the same mixin at different points
in the "class hierarchy" to create results that cannot be achieved with strict
inheritance.

Suppose we have two classes, Base1 and Base2, which share no common ancestor
(aside from Object). We can extend both of those classes with the same mixin:

    class Base1 {}
    class Base2 {}
    class Mixin {
      foo() { return "foo"; }
    }
    ExtendedBase1 = Composable.extend.call(Base1, Mixin);
    ExtendedBase2 = Composable.extend.call(Base2, Mixin);

    obj1 = new ExtendedBase1();
    obj2 = new ExtendedBase2();

We now have a *copy* of the Mixin behavior along two different prototype chains:

    obj1 --> ExtendedBase1 (copy of Mixin) --> Base1 --> Object
    obj2 --> ExtendedBase2 (copy of Mixin) --> Base2 --> Object

Such a structure is not possible in classical single inheritance. Even thought
obj1 and obj2 share no ancestor but Object, we can apply the same method to
both:

    obj1.foo(); // "foo"
    obj2.foo(); // "foo" also

This form of composition allows an enormous degree of flexibility in factoring
code. Each distinct behavior can be packaged as a mixin object or class, and
then combined in many ways to create a desired set of instantiable classes. This
permits a good separation of concerns. At the same time, capitalizing on the
native nature of the JavaScript prototype chain allows your codebase to
minimize the number of new concepts that must mastered by future maintainers.


Framework independence
======================

Because this approach just uses the JavaScript prototype chain in a standard
way, mixins designed this way should be generally independent of any framework.
