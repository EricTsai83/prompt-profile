# Blind review: curious-learner

Synthetic persona. Engine and model labels are removed; the order is shuffled.

## Profile A

**Headline:** You're a Python developer learning Rust and using the AI as a strict tutor: you ask for the concept, write the code yourself, then come back asking "is it idiomatic?"

**Archetype:** The Self-Taught Apprentice: You treat your AI assistant like a patient mentor, not a code vending machine. You ask for explanations, often framed in Python or JavaScript terms. You ask for exercises, quizzes and ASCII diagrams. Then you write the code yourself and bring it back for review. In about six weeks you went from asking what the borrow checker was complaining about to working out spatial hashing for a browser game with roughly 500 entities. Your sessions are short and focused, your prompts are lowercase and curious, and you seem to care more about understanding why something works than just getting it to compile.

### Traits

- **Tutor, not ghostwriter** (high): You explicitly stop the AI from doing the work for you. You want steps and hints, and you write the code yourself.
  - "Don't write it for me, just give me the steps."
  - "don't fix them, just tell me"
  - "explain AABB first, then let me try to implement it"
- **Review-seeker** (high): After you implement something, you bring it back to ask whether it's idiomatic, correct or missing an edge case.
  - "here's my answer to exercise 1, is it idiomatic?"
  - "here is my AABB function, any edge cases I missed?"
  - "I replaced the unwraps with ? and a custom error enum. better?"
- **Relentless why-asker** (high): Getting the fix isn't enough for you. You want to know why the error happened and why the language works the way it does.
  - "Why does this borrow checker error happen?"
  - "that feels dangerous, why is it allowed?"
  - "oh it was the requestAnimationFrame closure being dropped. why does that happen?"
- **Self-quizzer** (medium): You turn the AI into a study partner by asking for exercises and quizzes, and you keep notes on what you learn.
  - "can you give me 3 small exercises about lifetimes?"
  - "quiz me on Rust traits, 5 questions, wait for my answers"
  - "summarize what I learned today in 5 bullet points so I can put it in my notes"
- **Learns through comparison** (medium): You anchor new ideas in languages you already know, or ask for diagrams to make them concrete.
  - "explain ownership like I'm a Python developer"
  - "explain async/await in Rust vs JavaScript. why does Rust need an executor?"
  - "Draw me an ASCII diagram of what Rc<RefCell<T>> looks like in memory"

### Dimensions

- **Explain, attempt, review, repeat**: You run a tight learning loop: get the concept, do the work yourself, then ask for a check. You tell the AI outright not to write or fix your code. Sessions are short, with a new prompt every few minutes, and you debug on your own before coming back to find the root cause.
  - "Don't write it for me, just give me the steps."
  - "explain AABB first, then let me try to implement it"
  - "I implemented a fixed timestep with an accumulator. can you check my logic?"
  - "I replaced the unwraps with ? and a custom error enum. better?"
- **Lowercase, curious, openly excited**: Your prompts are short, casual questions. You often say what you currently think, which makes it easy to correct a misunderstanding. When something works, it shows in the double exclamation marks. You also add useful constraints like a question count or an entity count.
  - "I thought I only had one mutable reference."
  - "it compiles now!! next step: how do I write tests for the CLI?"
  - "quiz me on Rust traits, 5 questions, wait for my answers"
- **From Python to Rust and WASM**: You come from Python and know some JavaScript, and Rust is your current focus. You've covered smart pointers, serde, clap, error handling and async with tokio and smol. Now you're building a game in your wasm-game project with wasm-bindgen and wasm-pack.
  - "explain ownership like I'm a Python developer"
  - "explain async/await in Rust vs JavaScript. why does Rust need an executor?"
  - "what's the difference between wasm-bindgen and wasm-pack?"
- **The why behind the how**: You want idiomatic code and the reasoning behind design decisions, not just something that works. You ask about trade-offs, and you're getting into core game-engine topics: update loops, collision detection and spatial partitioning.
  - "is tokio the only option? what are the trade-offs with smol?"
  - "why is unwrap considered bad? when is it ok?"
  - "fixed timestep vs variable?"
- **Concepts first, then a game**: You moved steadily from ownership basics to a CLI todo app, then to refactoring with clap and custom errors, and then to a WebAssembly game that has to scale. You build in your own feedback: quizzes, explanations of what you got wrong, and a roadmap.
  - "I'm new to Rust. Can you explain ownership like I'm a Python developer?"
  - "I rewrote my todo app with clap."
  - "what did I get wrong? explain the ones I missed"
  - "give me a roadmap"

### Fun facts

- Thursday is your big Rust day with 13 of your 29 prompts. You never wrote a single prompt on a Monday, Tuesday, Friday or Saturday.
- You have two learning windows: late morning (10–12) and evening (18–21). Your latest prompt came in at 21:18, so these aren't midnight borrow-checker battles.
- Your correction rate is just 6.9%. That's about what you'd expect from someone who asks the AI not to write the code in the first place.
- rust-playground is your top project with 13 prompts, followed by wasm-game with 10 and notes with 6. Yes, your notes got their own project.
- Your longest streak is 1 day: 9 active days, 9 sessions, each one a focused lesson.

Coverage: 32 quotes kept, 0 dropped.

## Profile B

**Headline:** You're a Python developer learning Rust the slow, honest way: you ask why, write the code yourself, and come back asking whether it's idiomatic.

**Archetype:** The Self-Taught Rustacean: You treat the AI as a patient tutor, not a ghostwriter. You ask for the concept first, then exercises, a quiz or a roadmap. You go off and write the code yourself and come back with "better?" or "any edge cases I missed?" You've gone from borrow-checker confusion to a todo CLI, then a clap rewrite, then a WebAssembly game with collision detection. You're curious about memory layout and trade-offs, and you're happy to say "I thought I only had one mutable reference" when your mental model turns out to be wrong.

### Traits

- **Tutor, not ghostwriter** (high): You deliberately keep the AI away from your keyboard. It explains, quizzes and reviews; you write the code.
  - "Don't write it for me, just give me the steps."
  - "don't fix them, just tell me"
  - "explain AABB first, then let me try to implement it"
- **Review-loop learner** (high): You keep coming back with your own attempt and a short "better?" so the AI can check it.
  - "here's my answer to exercise 1, is it idiomatic?"
  - "I replaced the unwraps with ? and a custom error enum. better?"
  - "here is my AABB function, any edge cases I missed?"
- **Professional why-asker** (high): Knowing how to do something isn't enough for you. You want the reasons and the trade-offs too.
  - "why is unwrap considered bad? when is it ok?"
  - "what are the trade-offs with smol?"
  - "that feels dangerous, why is it allowed?"
- **Idiom-conscious** (medium): Getting it to compile is only step one. You want code that looks like proper Rust.
  - "is it idiomatic?"
  - "point out non-idiomatic parts"
- **Openly enthusiastic** (medium): You say plainly when you're confused and when something finally works.
  - "it compiles now!!"
  - "ok I think I get it."

### Dimensions

- **Explain first, then I'll do it**: You learn in short loops: get an explanation, try it yourself, then send your attempt back for review. You tell the AI outright not to write or fix things for you. Sessions are short, a few prompts about four minutes apart.
  - "Don't write it for me, just give me the steps."
  - "explain AABB first, then let me try to implement it"
  - "I implemented a fixed timestep with an accumulator. can you check my logic?"
  - "I replaced the unwraps with ? and a custom error enum. better?"
- **Casual, lowercase and full of whys**: Your prompts are short, casual and often lowercase. You show excitement and doubt openly, and you keep asking "why" and "when" to get at the reasoning and trade-offs. You also set clear limits: 5 questions, 3 exercises, ~500 entities.
  - "it compiles now!!"
  - "why is unwrap considered bad? when is it ok?"
  - "that feels dangerous, why is it allowed?"
  - "quiz me on Rust traits, 5 questions, wait for my answers"
- **Python roots, Rust in progress**: Python is home. Rust is where you're learning, and you've worked through smart pointers, serde, clap, error handling, tokio/smol and wasm-bindgen. You use JavaScript as a point of comparison and are now building game-engine basics in a WebAssembly game.
  - "explain ownership like I'm a Python developer"
  - "how do I serialize a Vec of structs to JSON with serde?"
  - "what's the difference between wasm-bindgen and wasm-pack?"
  - "explain async/await in Rust vs JavaScript"
- **Idioms, internals and game loops**: Compiling isn't enough for you; the code has to be idiomatic. You want to see how things sit in memory, and you think about game architecture and how it scales to many entities. You also keep notes on what you've learned.
  - "is it idiomatic?"
  - "Draw me an ASCII diagram of what Rc<RefCell<T>> looks like in memory"
  - "my game will have ~500 entities"
  - "summarize what I learned today in 5 bullet points so I can put it in my notes"
- **From borrow errors to spatial hashing**: You've moved from basic ownership questions to real projects: a CLI, a clap rewrite, then a WASM game with fixed timesteps, AABB collision and spatial partitioning. Your quiz answers show you understand static vs dynamic dispatch, and at least once you found a bug's cause on your own.
  - "Why does this borrow checker error happen?"
  - "I rewrote my todo app with clap."
  - "2: impl Trait in argument position is static dispatch. 3: dyn needs a vtable"
  - "oh it was the requestAnimationFrame closure being dropped."

### Fun facts

- Thursday is your big Rust day: 13 of your 29 prompts landed then. You never prompted on a Monday, Tuesday or Friday.
- Your sessions fall into two clusters, 10 a.m. to noon and 6 to 9 p.m. Your latest prompt came at 21:18.
- Your correction rate is only 6.9%, which makes sense when you're the one writing the code.
- rust-playground leads your projects with 13 prompts, followed by wasm-game with 10 and notes with 6.
- Your median prompt is 74 characters, about the length of "why is unwrap considered bad?"

Coverage: 33 quotes kept, 1 dropped.

## Profile C

**Headline:** You learn Rust by building things yourself, questioning the machinery, and asking for feedback once you have something to test.

**Archetype:** The Hands-On Questioner: You treat the assistant as a tutor and reviewer while keeping the implementation in your own hands. Your prompts move from ownership puzzles to CLI tools and browser games, with frequent stops to ask why something works, whether your code is idiomatic, and which edge cases you missed. A successful compile earns a celebration—and then another question.

### Traits

- **You keep the keyboard** (high): You repeatedly ask for steps, explanations, and review while reserving the implementation for yourself.
  - "Don't write it for me, just give me the steps."
  - "don't fix them, just tell me"
  - "I want to add collision detection. explain AABB first, then let me try to implement it"
- **Why comes after what** (high): You follow technical explanations and fixes with questions about the mechanism or trade-off behind them.
  - "so RefCell moves the borrow check to runtime? that feels dangerous, why is it allowed?"
  - "is tokio the only option? what are the trade-offs with smol?"
  - "oh it was the requestAnimationFrame closure being dropped. why does that happen?"
- **Compilation is a milestone** (high): You celebrate working code, then continue toward tests, idiomatic design, and overlooked cases.
  - "it compiles now!! next step: how do I write tests for the CLI?"
  - "can you review it and point out non-idiomatic parts?"
  - "here is my AABB function, any edge cases I missed?"
- **You invite the red pen** (high): You make your understanding visible through answers and implementations, then actively ask where it falls short.
  - "here's my answer to exercise 1, is it idiomatic?"
  - "I implemented a fixed timestep with an accumulator. can you check my logic?"
  - "what did I get wrong? explain the ones I missed"

### Dimensions

- **Try, review, refine**: You prefer guidance that leaves you responsible for the code. You break learning into small attempts, then ask for reviews of logic, style, and edge cases before moving forward.
  - "Don't write it for me, just give me the steps."
  - "I implemented a fixed timestep with an accumulator. can you check my logic?"
  - "here is my AABB function, any edge cases I missed?"
- **Brief, candid, specific**: You use short, informal English prompts and readily expose your current understanding. You also specify the teaching format you want, including when the assistant should wait and let you try.
  - "I thought I only had one mutable reference."
  - "quiz me on Rust traits, 5 questions, wait for my answers"
  - "I want to add collision detection. explain AABB first, then let me try to implement it"
- **Rust through real projects**: You begin with Python as a reference point for Rust, then practice serialization, argument parsing, and error handling through a CLI. Your later prompts explore browser WebAssembly and game systems, while your trait answers show an emerging vocabulary for dispatch and vtables.
  - "I'm new to Rust. Can you explain ownership like I'm a Python developer?"
  - "I'm stuck on step 3, how do I serialize a Vec of structs to JSON with serde?"
  - "Can I run Rust in the browser? I want to make a small game with WebAssembly"
  - "1: a trait is like an interface. 2: impl Trait in argument position is static dispatch. 3: dyn needs a vtable"
- **Mechanisms and trade-offs**: You want explanations of the decisions underneath an API or technique. Runtime borrowing, executor choices, and game-system correctness catch your attention because you want to understand when an approach makes sense.
  - "so RefCell moves the borrow check to runtime? that feels dangerous, why is it allowed?"
  - "is tokio the only option? what are the trade-offs with smol?"
  - "here is my AABB function, any edge cases I missed?"
- **Make understanding testable**: You turn explanations into exercises, quizzes, and project work. Your prompts broaden from Rust fundamentals into game development, and you explicitly ask for mistakes to be explained and future learning to be structured.
  - "can you give me 3 small exercises about lifetimes?"
  - "what should I learn next to get better at game dev in Rust? give me a roadmap"
  - "what did I get wrong? explain the ones I missed"

### Fun facts

- You logged 29 prompts across 9 sessions, all in Claude Code.
- Your median prompt length was 74 characters: compact questions are your default.
- Your project leaderboard was rust-playground with 13 prompts, wasm-game with 10, and notes with 6.
- Your busiest weekday was Thursday, with 13 prompts.
- Your latest recorded prompt time was 21:18 in America/New_York—your borrow checker questions had an evening shift.

Coverage: 28 quotes kept, 0 dropped.

## Profile D

**Headline:** You learn Rust by building things yourself, questioning the machinery underneath, and asking for feedback that sharpens your next attempt.

**Archetype:** The Hands-On Investigator: You treat AI as a tutor and reviewer while keeping the implementation in your own hands. Your questions move from ownership and borrowing into CLI tools and browser games, with frequent stops to ask why something works, where it breaks, and whether your solution feels idiomatic. You prefer a learning loop with explanations, independent attempts, and specific feedback.

### Traits

- **You keep the keyboard** (high): You repeatedly ask for explanations, steps, and review while reserving the implementation for yourself.
  - "Don't write it for me, just give me the steps."
  - "don't fix them, just tell me"
  - "explain AABB first, then let me try to implement it"
- **You interrogate the mechanism** (high): You follow explanations with questions about how the underlying system behaves, especially when its rules seem surprising.
  - "so RefCell moves the borrow check to runtime? that feels dangerous, why is it allowed?"
  - "explain async/await in Rust vs JavaScript. why does Rust need an executor?"
  - "oh it was the requestAnimationFrame closure being dropped. why does that happen?"
- **You revisit working code** (high): You ask whether your implementations are idiomatic, logically sound, and resilient to edge cases. Getting something running opens another round of questions.
  - "here's my answer to exercise 1, is it idiomatic?"
  - "I replaced the unwraps with ? and a custom error enum. better?"
  - "here is my AABB function, any edge cases I missed?"
- **You test your understanding** (medium): You deliberately create opportunities to attempt an answer and discover what you missed, using exercises and quizzes alongside project work.
  - "can you give me 3 small exercises about lifetimes?"
  - "quiz me on Rust traits, 5 questions, wait for my answers"
  - "what did I get wrong? explain the ones I missed"

### Dimensions

- **Explain, try, review**: You prefer guidance that leaves room for you to do the work. Across exercises, CLI development, and game mechanics, you implement a solution and then ask for a focused review.
  - "Don't write it for me, just give me the steps."
  - "I implemented a fixed timestep with an accumulator. can you check my logic?"
  - "explain AABB first, then let me try to implement it"
- **Short questions, clear boundaries**: You write brief, conversational prompts that make the next step clear. You also expose your current understanding and question trade-offs, giving the assistant something concrete to explain or challenge.
  - "I thought I only had one mutable reference."
  - "is tokio the only option? what are the trade-offs with smol?"
  - "quiz me on Rust traits, 5 questions, wait for my answers"
- **Rust through practical projects**: You describe yourself as new to Rust and use Python and JavaScript as reference points. Your exploration spans serialization, CLI tooling, async execution, and WebAssembly, with game development becoming a practical testing ground.
  - "I'm new to Rust. Can you explain ownership like I'm a Python developer?"
  - "I'm stuck on step 3, how do I serialize a Vec of structs to JSON with serde?"
  - "explain async/await in Rust vs JavaScript. why does Rust need an executor?"
  - "Can I run Rust in the browser? I want to make a small game with WebAssembly"
- **Mechanisms and rough edges**: You want to understand memory layout and lifecycle behavior, alongside getting code to run. You also care about idiomatic Rust and overlooked edge cases, so your reviews reach beyond basic functionality.
  - "Draw me an ASCII diagram of what Rc<RefCell<T>> looks like in memory"
  - "oh it was the requestAnimationFrame closure being dropped. why does that happen?"
  - "I rewrote my todo app with clap. can you review it and point out non-idiomatic parts?"
  - "here is my AABB function, any edge cases I missed?"
- **Practice with a feedback loop**: You turn explanations into exercises, quizzes, and working projects. You seek targeted explanations of mistakes and ask for a roadmap, suggesting that you want both immediate feedback and direction for what comes next.
  - "ok I think I get it. can you give me 3 small exercises about lifetimes?"
  - "what should I learn next to get better at game dev in Rust? give me a roadmap"
  - "what did I get wrong? explain the ones I missed"

### Fun facts

- Your 29 prompts span 9 sessions—all in Claude Code.
- Your median prompt length is 74 characters: compact questions are your usual format.
- Your busiest weekday is Thursday, with 13 prompts.
- Your project tally gives rust-playground 13 prompts, wasm-game 10, and notes 6.
- Your latest recorded prompt landed at 21:18 in the stats’ America/New_York timezone.

Coverage: 29 quotes kept, 0 dropped.
