import { Option } from './option';

export class AsyncOption<A> implements PromiseLike<A> {
  constructor(private value: Promise<Option<A>>) {}
  static of<A>(a: Promise<A>): AsyncOption<A> {
    return new AsyncOption(
      a.then((a) => Option.Some(a)).catch(() => Option.None<A>())
    );
  }

  static fromOption<A>(o: Option<A>): AsyncOption<A> {
    return new AsyncOption(Promise.resolve(o));
  }

  static fromNullable<A>(a: A | null | undefined): AsyncOption<A> {
    return new AsyncOption(Promise.resolve(Option.fromNullable(a)));
  }

  static fromFalsy<A>(a: A): AsyncOption<A> {
    return new AsyncOption(Promise.resolve(Option.fromFalsy(a)));
  }

  static fromPredicate<A>(a: A, predicate: (a: A) => boolean): AsyncOption<A> {
    return new AsyncOption(Promise.resolve(Option.fromPredicate(a, predicate)));
  }

  map<B>(f: (a: A) => B): AsyncOption<B> {
    return new AsyncOption(this.value.then((a) => a.map(f)));
  }

  flatMap<B>(f: (a: A) => AsyncOption<B>): AsyncOption<B> {
    return new AsyncOption(
      this.value.then((r) =>
        r.isSome() ? f(r.value).value : Promise.resolve(Option.None<B>())
      )
    );
  }

  unwrap(): Promise<A> {
    return this.value.then((r) => r.unwrap());
  }

  unwrapOr(a: A): Promise<A> {
    return this.value.then((r) => r.unwrapOr(a));
  }

  fold<B>(onNone: () => B, onSome: (a: A) => B): Promise<B> {
    return this.value.then((r) => r.fold(onNone, onSome));
  }

  then() {
    return this.value as any;
  }
}
