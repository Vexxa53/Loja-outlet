import * as React from "react";

type Fn<A extends unknown[], R> = (...a: A) => Promise<R>;
// React.cache só existe no runtime de servidor do Next; fora dele (testes/scripts) vira passagem direta.
export const memoPerRequest: <A extends unknown[], R>(fn: Fn<A, R>) => Fn<A, R> =
  (React as unknown as { cache?: <T>(f: T) => T }).cache ?? ((fn) => fn);
