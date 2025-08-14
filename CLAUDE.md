# Bash commands

- `deno check **/*.ts`: Run checks (linter and static types)
- `deno fmt`: Format code
- `deno test`: Run tests

# Code style

- Write small modules following the Single Responsibility Principle (modules
  should change only for one reason)
- Balance functional and object oriented programming: favor function composition
  patterns but define state as classes
- Don't use inheritance unless you're implementing polymorphism. Favor
  composition for code reuse purposes
- Write cohesive modules:
  - Structure code into different directories based on their business or
    infrastructure concern
  - Create single entry points to modules
  - Write modules using DDD
  - When modules interact with third-parties, follow a ports and adapters
    approach
  - Follow a healthy module dependency strategy:
    - Business modules can't depend on each other
    - Business modules can depend on infrastructure modules
    - Infrastructure modules can't depend on any other modules

# Workflow

- Follow a TDD approach: every change should start with a failing test
- Favor grey-box tests that describe the app's observable behavior:
  - You can set up your tests by interacting with third-party dependencies, if
    any
  - Assertions must exclusively target outputs and side effects. You can't leak
    implementation details into the tests
  - Only write unit or integration tests for implementation details to work
    around excessive combinatorial complexity
- After introducing implementation changes to make the test pass, and before
  refactoring, commit your code
- Don't refactor your code unless there's enough code repetition to clearly
  identify the structure
- When refactoring, create good abstractions that enrich the code's semantics
  and hide implementation details up the stack
- After refactoring, commit your code
- In general: never mix code changes with refactors in the same commit
- Always format your code before committing it
- Never commit code that's not passing all tests, has linter errors or failing
  static type checks
