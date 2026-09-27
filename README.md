# Domain Clash

### Turn hand signs into anime-inspired attacks.

**Domain Clash** is a fan-made fighting game where you can control your fighter with hand gestures in front of a webcam. Pick a character, perform a sign, and watch the game recognize your move. Prefer traditional controls? Every move can also be chosen with an on-screen button.

## Inspiration

We wanted to make a fighting game feel more physical and expressive than clicking through menus. *Jujutsu Kaisen*’s hand signs and dramatic battles were a natural fit: what if your own gestures could call the moves?

## What it does

Choose a fighter and battle solo or invite someone to a private online match. During a fight, make a move’s hand sign or select it with a button. The game tracks the match turn by turn, showing attacks, defenses, character abilities, and battle events as they happen.

## Hand tracking that learns your signs

The webcam tracks the shape and position of your hands. For signs with built-in recognition, the game checks the pose directly. For signs that need training, you can record examples yourself, and the system learns what that move looks like.

When you play, it compares your live pose with the patterns it has learned. You can record more examples to help it recognize natural variations in how you make a sign. The game also checks that you hold a pose long enough—and release it before using it again—to help prevent accidental or repeated moves.

The recordings contain hand-landmark data: points that describe finger and palm positions. You can save and import your gesture dataset.

## How to play

1. Choose a fighter.
2. Select **Start solo game** to fight a computer opponent, or choose **Multiplayer** to create or join a private match.
3. Allow camera access to use hand signs. You can use the move buttons instead.
4. Make and hold a move’s sign until it registers. Use **Block** to defend.

## Run it on your computer

You’ll need [Node.js 22.12 or newer](https://nodejs.org/), which includes npm.

1. Download the project as a ZIP and extract it.
2. Open a terminal or command prompt in the extracted project folder.
3. Run:

   ```sh
   npm install
   npm start
   ```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## How we built it

Domain Clash uses MediaPipe for hand tracking, a gesture-recognition system that combines built-in pose checks with patterns learned from recorded examples, and a shared battle system for solo and online fights.

## Challenges

Hand poses can look different depending on the player, camera angle, and distance from the webcam. We built gesture recording and dataset import/export so signs can be trained with real examples, and added hold, confidence, and release checks to make recognition more dependable during a match.

## Built with

- MediaPipe hand tracking
- TypeScript and JavaScript
- Vite
- Node.js

## Note

Domain Clash is an unofficial fan-made project inspired by *Jujutsu Kaisen*. It is not affiliated with or endorsed by the series’ creators or rights holders.
