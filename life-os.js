/* ========================================
   Life OS - Personal Operating System
   Main Application Logic
   ======================================== */

// Categories excluded from all-time stats (one-time tasks, low-signal noise)
const EXCLUDE_CATS = new Set(['other', 'one-time / other', 'one-time/other', 'general']);

// Weeks starting on/after this Sunday use the inferred-miss scoring rule (see scoreEntry)
const DEFAULT_SCORING_CUTOVER = '2026-10-11';
const DEFAULT_REMINDERS = { enabled: false, morning: '08:00', evening: '21:00', timezone: '' };

// Imported journal entries (text) when Convex isn't connected; see loadArchive()
const ARCHIVE_STORAGE_KEY = 'lifeOS_journalArchive';
const ARCHIVE_PAGE = 30;
const PDFJS_BASE = './vendor/pdfjs'; // pdfjs-dist 4.10.38, served from this site (vendor/README.md)
const PLAY_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';

// ========================================
// Guided meditation scripts
// ========================================
// Spoken by the Test button on the Meditate page
// Evening reflection fields, in order (also kept as a per-device draft until saved)
const REFLECTION_FIELDS = ['stoicWentWell', 'stoicFellShort', 'stoicHighlight1', 'stoicHighlight2', 'stoicHighlight3', 'stoicIntention'];
// A reflection or meditation before this hour counts for the day before (up past midnight is still that night)
const LATE_NIGHT_HOURS = 3;

const MED_TEST_LINE = 'Take a slow breath in, and let it go.';
// Recordings of every line (tools/meditation_audio.py); manifest.json maps text → file
const MED_AUDIO_BASE = 'audio/med/';

// Breathing patterns: phases of { label, seconds, scale (orb size), cue (spoken) }
const BREATH_PATTERNS = {
    calm: [{ label: 'Breathe in', seconds: 4, scale: 1, cue: 'Breathe in' }, { label: 'Slowly out', seconds: 6, scale: 0.55, cue: 'And slowly out' }],
    sigh: [{ label: 'Breathe in', seconds: 2, scale: 0.9, cue: 'In' }, { label: 'A little more', seconds: 1, scale: 1, cue: 'A little more' }, { label: 'Long sigh out', seconds: 6, scale: 0.55, cue: 'Long sigh out' }],
    box: [{ label: 'Breathe in', seconds: 4, scale: 1, cue: 'In' }, { label: 'Hold', seconds: 4, scale: 1, cue: 'Hold' }, { label: 'Breathe out', seconds: 4, scale: 0.55, cue: 'Out' }, { label: 'Hold', seconds: 4, scale: 0.55, cue: 'Hold' }],
    sleep: [{ label: 'Breathe in', seconds: 4, scale: 1, cue: 'Breathe in' }, { label: 'Hold', seconds: 7, scale: 1, cue: 'Hold' }, { label: 'Out, slowly', seconds: 8, scale: 0.55, cue: 'And out, slowly' }],
    easy: [{ label: 'Breathe in', seconds: 4, scale: 1 }, { label: 'Breathe out', seconds: 6, scale: 0.55 }]
};

// Each session builds a script for 1, 3 or 5 minutes. Steps:
//   { say, pause }                  speak (and caption), then rest `pause` seconds
//   { breathe, cycles, cues }       fixed number of breaths; cues = how many are voiced
//   { breathe, fill: true }         keep breathing until it's time for the closing
//   { closing: true }               everything after this is the ending (always played)
// Steps that won't fit in the remaining time are skipped, so the length stays right.
// Reflect's daily theme: a short talk, then prompts on the same idea. One theme a day in this
// order (themeOfDay), Stoic and therapy-style in turn. Every line is recorded: re-run
// tools/meditation_audio.py after editing any of them.
const REFLECT_THEMES = [
    {
        id: 'control', kind: 'stoic', title: "What's up to you",
        talk: [
            'The Stoic teacher Epictetus opened his handbook with one idea. Some things are up to us, and some are not. Our judgments, our effort and our choices are ours. Most everything else is not.',
            "Much of our stress comes from gripping things we can't control. Other people's opinions. The traffic. How a meeting will go. We spend our energy there, and have less left for what we can actually do.",
            "This isn't giving up. It's aiming. You put your full effort where it counts, and you let the outcome be what it will be."
        ],
        prompts: [
            "Bring to mind something that's been weighing on you. Which part of it is actually up to you?",
            'Now picture letting go of the rest, just for today. Notice how that feels in your body.',
            'What is one small thing within your control that you can do about it today?'
        ],
        carry: 'Today, put your effort where it counts, and let the rest be.'
    },
    {
        id: 'thoughts', kind: 'therapy', title: 'Thoughts are not facts',
        talk: [
            'Your mind is a busy storyteller. It predicts, judges and warns, all day long. Some of its stories are useful. Some are just noise, said with total confidence.',
            "Acceptance and commitment therapy has a simple move for this. Instead of thinking, I'm going to fail, you notice: I'm having the thought that I'm going to fail.",
            "The thought is still there. But now you're looking at it, rather than through it. That small gap gives you room to choose what to do next."
        ],
        prompts: [
            "Notice a thought that's been loud lately. Say it silently, with the words I'm having the thought that, in front of it.",
            "Watch how the thought sits there now. You don't have to argue with it, or obey it.",
            "If that thought weren't steering, what would you choose to do today?"
        ],
        carry: 'Today, when a harsh thought shows up, name it as a thought, and keep going.'
    },
    {
        id: 'obstacle', kind: 'stoic', title: 'The obstacle is the way',
        talk: [
            'Marcus Aurelius ran an empire through war and plague. In his private notebook he wrote that the obstacle to action can advance action. What stands in the way becomes the way.',
            'A setback can be a chance to practice patience. A difficult person can be a chance to practice kindness. A failure can teach what success never would.',
            "This doesn't make hard things pleasant. It means no situation is wasted. There's always something in it you can use."
        ],
        prompts: [
            'Think of an obstacle in your life right now. Hold it in mind without pushing it away.',
            'Ask yourself: what quality could this help me build? Patience, courage, creativity?',
            'Picture yourself meeting it with that quality. What does the first step look like?'
        ],
        carry: "Today, when something gets in your way, ask what it's giving you the chance to practice."
    },
    {
        id: 'leaves', kind: 'therapy', title: 'Leaves on a stream',
        talk: [
            'Here is an exercise from acceptance and commitment therapy. Imagine sitting beside a gentle stream. Leaves float past on the water.',
            'Each time a thought comes, place it on a leaf, and watch it drift away. Worries, plans, memories, even the thought that this is silly. All of them go on leaves.',
            "You're not trying to stop thinking. You're practicing letting thoughts come and go, without being swept downstream with them."
        ],
        prompts: [
            'Picture the stream now. As each thought arrives, set it on a leaf, and let the water carry it.',
            "If you get pulled into a thought, that's normal. Notice it, and gently return to the bank.",
            'Notice the space between thoughts, however brief. Rest there for a moment.'
        ],
        carry: 'Today, when your mind gets busy, picture the stream, and let one thought float by.'
    },
    {
        id: 'judgments', kind: 'stoic', title: "It's the story, not the event",
        talk: [
            'Epictetus taught that people are disturbed not by things, but by their opinions about things. The event happens. Then we add a story about what it means.',
            "Someone is late, and the story becomes, they don't respect me. A plan falls through, and it becomes, nothing ever works out. The story often hurts more than the event.",
            "You can't always change what happens. But you can examine the story, and ask whether it's true, and whether it helps."
        ],
        prompts: [
            'Recall something that annoyed or upset you recently. What actually happened, in plain facts?',
            'Now notice the story you added on top. What did you tell yourself it meant?',
            "Is there another way to see it, one that's just as true, and kinder?"
        ],
        carry: "Today, when something stings, separate what happened from the story you're telling about it."
    },
    {
        id: 'room', kind: 'therapy', title: 'Making room',
        talk: [
            'When a hard feeling shows up, our instinct is to fight it, or run from it. But pushing feelings away often makes them louder, and longer.',
            "Acceptance and commitment therapy offers another option. Make room for the feeling. Let it be there, the way you'd let a guest sit in the corner while you get on with your day.",
            "You don't have to like the feeling. You just stop spending all your energy wrestling with it."
        ],
        prompts: [
            'Notice any uncomfortable feeling present right now. Where do you feel it in your body?',
            'Breathe into that place. Imagine the space around it getting a little bigger, so the feeling has room.',
            'Say silently: I can feel this, and still do what matters to me.'
        ],
        carry: 'Today, let difficult feelings come along for the ride, without letting them drive.'
    },
    {
        id: 'time', kind: 'stoic', title: 'Life is long enough',
        talk: [
            "Seneca wrote that life isn't short. We make it short by wasting it. We guard our money carefully, he said, but give our time away to anyone who asks.",
            "Hours disappear into scrolling, worrying, and things we don't really value. Then we say we never have enough time.",
            "His advice was simple. Treat your time as your most precious possession, because it's the one thing you can never get back."
        ],
        prompts: [
            "Think about yesterday. Where did your time go that you'd like back?",
            'Now think of one thing that truly matters to you. When did you last give it real time?',
            "Choose one block of time today that you'll protect for what matters."
        ],
        carry: "Today, spend your hours like they're worth more than money, because they are."
    },
    {
        id: 'urge', kind: 'therapy', title: 'Surfing the urge',
        talk: [
            "Cravings feel like they'll keep building until we give in. But they don't. An urge is more like a wave. It rises, it peaks, and then it falls.",
            'Therapists call this urge surfing. Instead of fighting the urge or obeying it, you ride it. You notice where it shows up in your body, and you breathe with it while it passes.',
            'Every time you surf an urge without acting on it, the next one tends to be a little easier.'
        ],
        prompts: [
            'Think of an urge you often face. A snack, a drink, your phone, a purchase. Picture it arriving.',
            "Notice where you'd feel it in your body. Breathe slowly, and imagine riding the wave up.",
            "Now picture it cresting, and easing back down. You're still here, and you didn't have to act."
        ],
        carry: 'Today, when an urge rises, ride it for a few breaths before you decide anything.'
    },
    {
        id: 'above', kind: 'stoic', title: 'The view from above',
        talk: [
            'Marcus Aurelius often pictured life from high above. Cities, armies and crowds, all small and passing. It helped him hold his worries in proportion.',
            "From up there, the email you're dreading, the awkward conversation, the bad day, all shrink to their true size.",
            "This isn't about feeling unimportant. It's about seeing what's actually big, and what only feels big right now."
        ],
        prompts: [
            'Picture yourself sitting right where you are. Now rise slowly above the building.',
            "Keep rising. See your town, your country, the curve of the earth. Find today's worry from up here.",
            'From this height, what still seems worth your attention? Come gently back down with that.'
        ],
        carry: 'Today, when something feels huge, take the view from above.'
    },
    {
        id: 'name-it', kind: 'therapy', title: 'Name it to tame it',
        talk: [
            "When emotions run high, we often feel them as one big wave. Upset. Stressed. Off. That fog makes them harder to handle.",
            'Studies of emotion suggest that simply putting a feeling into words can turn its volume down. Naming it helps you step back from it.',
            'The more precise the word, the better. Not just bad, but disappointed, or lonely, or embarrassed.'
        ],
        prompts: [
            'Check in with yourself right now. What are you feeling? Try to find the most precise word.',
            'Is there a second feeling underneath the first? Name that one too.',
            'Notice what happens to the feelings once they have names.'
        ],
        carry: 'Today, when a feeling surges, pause, and give it a precise name.'
    },
    {
        id: 'rehearse', kind: 'stoic', title: 'Rehearsing setbacks',
        talk: [
            "Seneca advised picturing misfortunes before they happen. Not to worry, but to prepare. A blow that's expected, he wrote, lands more lightly.",
            'Imagine your plans for today going wrong. The meeting runs long. The workout gets cut short. Someone is short with you.',
            "When you've already pictured it calmly, you're less likely to be knocked off balance. And you'll notice how often things go fine."
        ],
        prompts: [
            "Pick one thing you're counting on today. Picture it going wrong, calmly, as if watching a film.",
            'How would you want to respond? See yourself doing that, steady and clear.',
            "Now notice: even if it goes wrong, you'd be able to handle it."
        ],
        carry: "Today, expect a few bumps, and meet them like you've already practiced."
    },
    {
        id: 'values', kind: 'therapy', title: 'Values as a compass',
        talk: [
            "Goals are like destinations. Once you reach one, it's done. Values are more like a compass direction. You never arrive at being kind, or healthy, or brave. You keep heading that way.",
            'Acceptance and commitment therapy puts values at the center. When life gets hard, they tell you which way to turn, even when the destination is far off.',
            'On a day you miss a goal, you can still act on a value in the next five minutes.'
        ],
        prompts: [
            'Ask yourself: what do I want to stand for? Pick one or two words that feel true.',
            'Think of a small action today that would move you in that direction.',
            'Picture yourself doing it. Notice how it feels to act from what you care about.'
        ],
        carry: 'Today, let your values point the way, one small step at a time.'
    },
    {
        id: 'discomfort', kind: 'stoic', title: 'Practicing discomfort',
        talk: [
            'Seneca suggested setting aside a few days to live simply. Plain food, rough clothes, little comfort. Then ask yourself: is this what I was so afraid of?',
            'Choosing small discomforts, like a cold shower, a hard workout, or skipping a treat, teaches you that you can handle more than you think.',
            "It also makes ordinary comforts feel like gifts again, instead of things you're owed."
        ],
        prompts: [
            'Think of a comfort you lean on most days. How would you feel without it for a day?',
            'Choose one small discomfort you could practice this week. Something safe and simple.',
            "Picture yourself doing it, and finding out you're more capable than you thought."
        ],
        carry: 'Today, do one hard thing on purpose, and notice that you can.'
    },
    {
        id: 'kind-voice', kind: 'therapy', title: 'Talking to yourself like a friend',
        talk: [
            'Notice how you speak to yourself after a mistake. Many of us say things we would never say to a friend.',
            "Researchers who study self-compassion describe three parts. Notice that you're struggling. Remember that everyone struggles sometimes. And offer yourself some kindness.",
            "This isn't letting yourself off the hook. People who are kind to themselves after a setback are often more likely to try again."
        ],
        prompts: [
            'Bring to mind a recent moment when you were hard on yourself. What did you say?',
            'Now imagine a good friend in the same spot. What would you say to them?',
            'Say that to yourself now, slowly, and let it land.'
        ],
        carry: "Today, speak to yourself the way you'd speak to someone you care about."
    },
    {
        id: 'present', kind: 'stoic', title: 'Only this moment',
        talk: [
            "Marcus Aurelius noted that the present moment is the only thing we can ever lose, because it's the only thing we really have. The past is gone, and the future isn't here yet.",
            'Yet we spend so much of now replaying yesterday, or rehearsing tomorrow.',
            'Coming back to this moment, this breath, this task, is where life actually happens.'
        ],
        prompts: [
            'Notice a few things right now. The air on your skin, the sounds around you, the weight of your body.',
            'If your mind drifts to the past or the future, gently return to this breath.',
            'What is the one task in front of you today that deserves your full attention?'
        ],
        carry: 'Today, when your mind runs ahead, come back to the one thing in front of you.'
    },
    {
        id: 'check-story', kind: 'therapy', title: 'Checking the story',
        talk: [
            "When we're anxious, the mind often jumps to the worst case. One mistake becomes, I'll lose my job. A short reply becomes, they're angry with me.",
            "Cognitive behavioral therapy teaches you to treat these thoughts as guesses, and to check them. What's the evidence? What else could explain this? What's most likely?",
            'Often the most likely story is far more ordinary than the scary one.'
        ],
        prompts: [
            "Think of a worry that's been on your mind. What's the worst case your mind predicts?",
            "Now ask: what's the most likely outcome? And what's the best case?",
            'If a friend had this worry, what would you tell them?'
        ],
        carry: "Today, when your mind jumps to the worst case, ask what's most likely."
    },
    {
        id: 'review', kind: 'stoic', title: 'The evening review',
        talk: [
            'Each night, Seneca would review his day. What bad habit did I resist today? Where did I fall short? Where did I do well?',
            'He did it without beating himself up. He saw each day as practice, and the review as a coach going over the game.',
            'Your evening reflection in this app is built on the same idea. A few honest minutes, every night.'
        ],
        prompts: [
            'Look back over the last day. Where did you act at your best?',
            'Where did you fall short? Notice it plainly, without judgment.',
            "What's one thing you'll do differently next time?"
        ],
        carry: 'Tonight, give yourself a few honest minutes to review the day.'
    },
    {
        id: 'opposite', kind: 'therapy', title: 'Opposite action',
        talk: [
            'Every emotion comes with an urge. Fear says avoid. Sadness says withdraw. Anger says attack.',
            "Dialectical behavior therapy has a skill called opposite action. When a feeling's urge won't help you, you gently do the opposite. Feeling low? Go for a walk, or call someone.",
            'Acting opposite to the urge can, over time, change the feeling itself.'
        ],
        prompts: [
            "Think of a feeling that's been steering you lately. What does it urge you to do?",
            'Now picture the opposite action. Something small and doable.',
            'Imagine doing it today, and how you might feel afterward.'
        ],
        carry: 'Today, when a feeling pushes you somewhere unhelpful, take one small step the other way.'
    },
    {
        id: 'citadel', kind: 'stoic', title: 'The inner citadel',
        talk: [
            'People seek retreats, Marcus Aurelius wrote, in the country, at the seashore, in the mountains. But you can retreat into yourself any time you like.',
            'He called a mind free of passion a citadel. Nothing outside can get in unless you let it.',
            "This calm isn't somewhere you travel to. It's somewhere you return to, a few breaths at a time."
        ],
        prompts: [
            'Imagine a quiet place inside you. Notice its stillness.',
            'Let the noise of the day stay outside the walls for now.',
            'Remember that you can come back here in a single breath, anywhere.'
        ],
        carry: 'Today, when things get noisy, take three breaths, and step inside.'
    },
    {
        id: 'sky', kind: 'therapy', title: 'You are the sky',
        talk: [
            'A common image in mindfulness goes like this. Your thoughts and feelings are like weather. Storms, clouds, bright patches. You are the sky.',
            "The weather changes constantly. The sky holds all of it, and isn't harmed by any of it.",
            'Acceptance and commitment therapy calls this the noticing self. There is a part of you that can watch your experience, steady, whatever passes through.'
        ],
        prompts: [
            'Notice the weather inside you right now. Calm, cloudy, or stormy?',
            "Now notice the part of you that is noticing. It isn't the weather. It's the sky.",
            'Rest as the sky for a few breaths, and let the weather move.'
        ],
        carry: 'Today, remember that bad weather passes, and you are the sky that holds it.'
    },
    {
        id: 'cooperation', kind: 'stoic', title: 'Made for each other',
        talk: [
            "Marcus Aurelius began one morning by reminding himself he'd meet difficult people that day. Then he added: we are made for cooperation, like feet, like hands, like the upper and lower rows of teeth.",
            'To work against each other, he wrote, is against nature.',
            'The people who frustrate you are often struggling too. And you need each other more than it seems.'
        ],
        prompts: [
            'Think of someone you find difficult. Picture them as a person who also wants to do well.',
            "What might they be dealing with that you can't see?",
            'How could you work with them, rather than against them, today?'
        ],
        carry: "Today, treat even difficult people as teammates you haven't figured out yet."
    },
    {
        id: 'good-things', kind: 'therapy', title: 'Three good things',
        talk: [
            'Our minds are built to notice threats and problems. It kept our ancestors alive. But it means good moments slip past without being noticed.',
            'One simple practice psychologists have studied is noting three good things each day, and why they happened.',
            "Over time, it trains your attention to catch what's going right, not just what's going wrong."
        ],
        prompts: [
            'Think of one good thing from the past day, however small. Why did it happen?',
            'Now a second. Maybe something someone did for you.',
            'And a third. Let yourself really feel each one.'
        ],
        carry: 'Today, keep an eye out for three good things.'
    },
    {
        id: 'be-one', kind: 'stoic', title: 'Be one now',
        talk: [
            'Marcus Aurelius wrote a blunt note to himself. Stop arguing about what a good person should be. Be one.',
            "It's easy to read about habits, plan the perfect week, and wait for the right moment. The Stoics cared about action, today, imperfect as it is.",
            "You don't need to be ready. You just need to take the next right step."
        ],
        prompts: [
            "What's something you've been planning or thinking about, instead of doing?",
            'What would the next right step be? Make it small enough to do today.',
            'Picture yourself taking it, without waiting to feel ready.'
        ],
        carry: 'Today, skip the debate, and take the next right step.'
    },
    {
        id: 'start-tiny', kind: 'therapy', title: 'Action before motivation',
        talk: [
            'We often wait to feel motivated before we act. But motivation tends to come after we start, not before.',
            'Therapists who treat low mood often begin with small actions, not big insights. A short walk. A tidy desk. A text to a friend. Doing something small can lift the mood a little.',
            "So when you don't feel like it, make the first step tiny, and let the feeling catch up."
        ],
        prompts: [
            "Think of something you've been putting off. What's the smallest possible first step?",
            'Make it even smaller. Something you could do in two minutes.',
            "Picture doing just that step, and stopping if you want. Notice whether you'd want to keep going."
        ],
        carry: "Today, don't wait to feel like it. Start tiny."
    },
    {
        id: 'enough', kind: 'stoic', title: 'Enough',
        talk: [
            "Seneca wrote that it isn't the person who has too little who is poor, but the one who craves more.",
            "There's always a newer phone, a bigger place, a better deal. Wanting more can feel like ambition, but often it just moves the finish line.",
            "For the Stoics, wealth was wanting less. Noticing what's enough is its own kind of freedom."
        ],
        prompts: [
            "Think of something you've been wanting to buy or have. Notice the pull of it.",
            "Now name, silently, three things you already have that you'd hate to lose.",
            'Ask yourself: what would enough look like here?'
        ],
        carry: "Today, before you reach for more, notice what's already enough."
    },
    {
        id: 'rest', kind: 'therapy', title: 'Rest is part of the work',
        talk: [
            "Training doesn't make you stronger on its own. Your body adapts while it recovers. Without rest, effort just piles up as fatigue.",
            'The same is true for your mind. Focus, patience and willpower all run down, and they come back with real rest. Sleep, a walk, time away from a screen.',
            "Rest isn't the opposite of discipline. It's part of it."
        ],
        prompts: [
            'Check in with your energy right now. Are you running on empty, half full, or full?',
            'What kind of rest would help most today? Sleep, quiet, movement, or people?',
            'Plan one moment of real rest today, and protect it like a meeting.'
        ],
        carry: 'Today, treat rest as part of the plan, not a reward for finishing it.'
    },
    {
        id: 'as-it-is', kind: 'stoic', title: 'Wanting what happens',
        talk: [
            "Epictetus gave this advice. Don't ask for things to happen as you wish. Wish for them to happen as they do happen, and your life will go smoothly.",
            'It sounds passive, but it is practical. Most frustration comes from the gap between what we demanded, and what actually happened.',
            "When you accept what's already here, your energy is free for the next useful move."
        ],
        prompts: [
            "Think of something recent that didn't go the way you wanted. Notice the resistance.",
            'Now try saying silently: this is what happened. I can work with this.',
            "What's the next useful move, starting from here?"
        ],
        carry: "Today, meet what happens with: okay, this is what I'm working with."
    },
    {
        id: 'beginner', kind: 'therapy', title: "Beginner's mind",
        talk: [
            "In Zen there's an idea called beginner's mind. In the expert's mind there are few possibilities. In the beginner's mind there are many.",
            "When we've done something a hundred times, we stop really seeing it. Our routine, the people closest to us, our own street, fade into the background.",
            'Meeting familiar things with fresh curiosity can make an ordinary day feel new again.'
        ],
        prompts: [
            'Notice your breath as if for the very first time. Its temperature, its rhythm.',
            "Think of a routine you'll do today. How could you do it with fresh eyes?",
            "Pick one familiar person you'll see today. What could you be curious about with them?"
        ],
        carry: "Today, look at one familiar thing as if you'd never seen it before."
    },
    {
        id: 'anger', kind: 'stoic', title: 'The remedy is delay',
        talk: [
            'Seneca wrote a whole book on anger. His best remedy was simple: delay. Anger is strongest in its first moments, and it fades if you wait.',
            'In those first moments, we say and send things we later regret.',
            "A pause isn't weakness. It's giving your better judgment time to arrive."
        ],
        prompts: [
            'Think of a time anger made you act too fast. What happened?',
            'Picture the same moment, but this time you pause, and take three breaths.',
            'What would you have said or done after the pause?'
        ],
        carry: 'Today, when anger flares, wait before you speak or send anything.'
    },
    {
        id: 'kindness', kind: 'therapy', title: 'Loving-kindness',
        talk: [
            'Loving-kindness is an old meditation practice. You silently offer good wishes, first to yourself, then to people close to you, and outward from there.',
            'It can feel awkward at first. But it gently trains your mind toward warmth, instead of judgment.',
            "And it's hard to stay irritated with someone while you're wishing them well."
        ],
        prompts: [
            'Silently say to yourself: may I be well. May I be at ease.',
            'Now picture someone you love, and wish the same for them.',
            'Now someone you find difficult. May you be well. May you be at ease.'
        ],
        carry: 'Today, silently wish someone well, especially someone who tests your patience.'
    }
];

const MEDITATIONS = {
    breathe: {
        title: 'Breathe',
        blurb: 'Calm down with long, slow exhales',
        icon: '<path d="M3 8.5h10.5a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 16.5h7"/>',
        build: min => [
            { say: "Welcome. Let's take a moment to slow down.", pause: 1 },
            ...(min > 1 ? [{ say: 'Sit comfortably, and let your shoulders drop away from your ears.', pause: 2 }] : []),
            ...(min > 1 ? [
                { say: 'First, two double breaths. In through the nose, then a little more, then a long sigh out.', pause: 1 },
                { breathe: 'sigh', cycles: 2, cues: 2 }
            ] : []),
            { say: 'Now breathe in through your nose for four, and out slowly for six. Let the out-breath be longer.', pause: 0.5 },
            { breathe: 'calm', cycles: min > 1 ? 4 : 3, cues: 2 },
            ...(min >= 5 ? [
                { say: "Let's steady the rhythm. In for four, hold for four, out for four, hold for four.", pause: 0.5 },
                { breathe: 'box', cycles: 4, cues: 2 },
                { say: 'And back to long, easy exhales.', pause: 0.5 }
            ] : []),
            ...(min > 1 ? [{ say: "If your mind wanders, that's fine. Just come back to the next breath.", pause: 1 }] : []),
            { breathe: 'calm', fill: true },
            { closing: true },
            { say: 'Let your breathing return to its own pace.', pause: 2 },
            { say: 'Notice how you feel now, compared with a few minutes ago. Take that calm with you.', pause: 1 }
        ]
    },
    reflect: {
        title: 'Reflect',
        blurb: "A short talk on today's theme, then a few minutes with it",
        icon: '<path d="M4 18.5h16M7 15a5 5 0 0 1 10 0M12 4.5v3M5.4 8.4l1.6 1.6M18.6 8.4 17 10"/>',
        themes: REFLECT_THEMES,
        // The day's theme: arrive (3 and 5 min), the talk, then its prompts. 1 minute is the core idea and one prompt
        build: (min, theme = REFLECT_THEMES[0]) => {
            const short = min < 3;
            return [
                ...(short ? [] : [
                    { say: 'Welcome. Find a comfortable position, and close your eyes if you like.', pause: 1 },
                    { say: 'Take a few slow breaths to arrive.', pause: 0.5 },
                    { breathe: 'calm', cycles: 2, cues: 1 }
                ]),
                { say: `Today's theme: ${theme.title}.`, pause: 1.5 },
                ...theme.talk.slice(0, short ? 1 : 3).map(say => ({ say, pause: 1.5 })),
                ...theme.prompts.slice(0, min >= 5 ? 3 : short ? 1 : 2).map(say => ({ say, pause: min >= 5 ? 20 : short ? 6 : 12 })),
                { breathe: 'easy', fill: true },
                { closing: true },
                ...(short ? [] : [{ say: 'Come back to your breath, and to the room around you.', pause: 2 }]),
                { say: theme.carry, pause: 1 }
            ];
        }
    },
    body: {
        title: 'Body',
        blurb: 'Release tension with a scan and gentle stretches',
        icon: '<circle cx="12" cy="4.5" r="2"/><path d="M4 9.5 12 8l8 1.5M12 8v6.5l-3.5 6M12 14.5l3.5 6"/>',
        build: min => [
            { say: 'Welcome. Sit tall, feet flat on the floor, hands resting on your thighs.', pause: 1 },
            { say: 'Take a slow breath in, and let it out.', pause: 3 },
            { say: 'Lift your shoulders up toward your ears. Hold for a moment.', pause: 3 },
            { say: 'And let them fall.', pause: 3 },
            ...(min > 1 ? [
                { say: 'Gently drop your right ear toward your right shoulder. Breathe into the left side of your neck.', pause: 8 },
                { say: 'Slowly bring your head through the middle, and over to the left.', pause: 8 },
                { say: 'And back to center.', pause: 2 },
                { say: 'Reach your right arm overhead and lean gently to the left. Feel the stretch along your side.', pause: 8 },
                { say: 'Come back up, and reach the other arm over to the right.', pause: 8 }
            ] : []),
            ...(min >= 5 ? [
                { say: 'Place your left hand on your right knee and twist gently to the right. Look over your shoulder.', pause: 8 },
                { say: 'Come back to center, and twist to the other side.', pause: 8 },
                { say: 'Now fold forward slowly, letting your arms and head hang heavy.', pause: 10 },
                { say: 'Roll up one vertebra at a time, head last.', pause: 4 }
            ] : []),
            { say: 'Now close your eyes and scan down from the top of your head. Your forehead, your jaw. Let them soften.', pause: min > 1 ? 6 : 3 },
            { say: 'Your shoulders, your chest, your belly. Let them soften.', pause: min > 1 ? 6 : 3 },
            { say: 'Your hips, your legs, all the way down to your feet.', pause: min > 1 ? 6 : 3 },
            { breathe: 'easy', fill: true },
            { closing: true },
            { say: 'Take one more deep breath in, and let it all go.', pause: 3 },
            { say: 'Notice how your body feels now.', pause: 1 }
        ]
    },
    sleep: {
        title: 'Sleep',
        blurb: 'Slow down and let the day go before bed',
        icon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
        gentle: true,
        build: min => [
            { say: 'Welcome. Get comfortable, and let your body be heavy.', pause: 2 },
            { say: "There's nothing left to do today.", pause: 3 },
            { say: "We'll breathe in for four, hold for seven, and breathe out slowly for eight.", pause: 1 },
            { breathe: 'sleep', cycles: min > 1 ? 4 : 2, cues: 2 },
            ...(min > 1 ? [
                { say: 'Let your jaw loosen. Let your eyes soften.', pause: 6 },
                { say: "Feel the bed holding you up. You don't have to hold anything.", pause: 8 }
            ] : []),
            ...(min >= 5 ? [
                { say: "If thoughts about today come up, picture setting each one down on a shelf. They'll be there tomorrow.", pause: 10 },
                { say: 'Now just breathe naturally, and count each out-breath, from ten down to one.', pause: 2 }
            ] : []),
            { breathe: 'easy', fill: true },
            { closing: true },
            { say: 'Keep breathing slowly. Drift off whenever you are ready.', pause: 2 }
        ]
    }
};

class LifeOS {
    constructor() {
        this.STORAGE_KEY = 'lifeOSData';
        this.data = this.loadData();
        this.currentWeekIndex = -1; // -1 = latest
        this.charts = {};

        // Initialize Convex sync if URL is saved
        this.convex = null;
        const savedConvexUrl = localStorage.getItem('lifeOS_convexUrl');
        if (savedConvexUrl && window.ConvexDataLayer) {
            this.convex = new ConvexDataLayer(savedConvexUrl, localStorage.getItem('lifeOS_appKey'));
        }
        this._convexInitialized = false;

        this.init();
    }

    // ========================================
    // Data Layer
    // ========================================
    getDefaultData() {
        return {
            goals: this.getDefaultGoals(),
            categories: ['Morning Protocol', 'Midday Protocol', 'Evening Protocol', 'Mental Health', 'Physical Health', 'Budgeting', 'Work', 'Monthly', 'Cooking', 'Other'],
            weeks: [],
            transactions: [],
            accounts: [],
            budgets: {},
            habits: this.getDefaultHabits(),
            habitLog: {},       // { 'YYYY-MM-DD': { habitId: true/false } }
            adhocTasks: [],     // { id, text, completed, weekStart, created }
            healthLog: [],      // { date, weight, sleep, energy }
            journalEntries: [], // { date, text, mood, type }
            weeklyReviews: [],  // { weekDate, wins, improvements, priorities, rating }
            eveningReflections: [], // { date, timestamp, wentWell, fellShort, highlights[], valuesRating, intention } (older ones: gratitude)
            journalImportDates: [], // local dates of entries imported from another journal app (text is in the archive)
            activityLog: [],
            meditationLog: [],  // { date, ts, kind, minutes } — finished guided sessions
            settings: {
                scoringCutover: DEFAULT_SCORING_CUTOVER,
                defaultBudgets: {
                    'Food & Dining': 400,
                    'Groceries': 600,
                    'Transportation': 200,
                    'Housing': 2500,
                    'Utilities': 300,
                    'Entertainment': 200,
                    'Shopping': 300,
                    'Health': 200,
                    'Personal': 150,
                    'Other': 200
                }
            }
        };
    }

    getDefaultGoals() {
        return [
            // Morning Protocol
            { category: 'Morning Protocol', name: 'Phone away/airplane on wake', target: 'daily' },
            { category: 'Morning Protocol', name: 'Up by 7:15AM', target: 'weekdays' },
            { category: 'Morning Protocol', name: 'Hydrate 20oz immediately', target: 'daily' },
            { category: 'Morning Protocol', name: 'High protein/fat breakfast', target: 'daily' },
            { category: 'Morning Protocol', name: 'Skincare AM', target: 'daily' },
            { category: 'Morning Protocol', name: 'Caffeine delay 60 min', target: 'daily' },
            { category: 'Morning Protocol', name: 'Outdoor exposure 10-20 min', target: 'daily' },
            // Midday Protocol
            { category: 'Midday Protocol', name: 'Cold shower finish 60s', target: 'x1' },
            { category: 'Midday Protocol', name: 'NSDR 10-20 min', target: 'daily' },
            // Evening Protocol
            { category: 'Evening Protocol', name: 'Review expenses 5 min', target: 'daily' },
            { category: 'Evening Protocol', name: 'Skincare PM', target: 'daily' },
            { category: 'Evening Protocol', name: 'Phone parked before wind-down', target: 'daily' },
            { category: 'Evening Protocol', name: 'Gratitude Journal', target: 'x7' },
            { category: 'Evening Protocol', name: 'Read before bed', target: 'daily' },
            { category: 'Evening Protocol', name: 'Meditate (3-5 min, long exhales)', target: 'daily' },
            { category: 'Evening Protocol', name: 'Review strikes', target: 'daily' },
            { category: 'Evening Protocol', name: 'In bed by 11:15PM', target: 'weeknights' },
            { category: 'Evening Protocol', name: 'Stoic Review + Tomorrow\'s To-Do', target: 'daily' },
            // Mental Health
            { category: 'Mental Health', name: 'Written Journaling 10 min x2 (Wed & Sat)', target: 'x2' },
            { category: 'Mental Health', name: 'Open Writing Session (life stories, personal voice)', target: 'weekly' },
            { category: 'Mental Health', name: 'Read 50 pages non-fiction OR 2 audiobook chapters', target: 'weekly' },
            { category: 'Mental Health', name: 'Read 1 parenting book chapter/article', target: 'weekly' },
            { category: 'Mental Health', name: 'Max 15 min Instagram/day', target: 'daily' },
            { category: 'Mental Health', name: 'Set week specific goals on Monday', target: 'weekly' },
            // Physical Health
            { category: 'Physical Health', name: '1 Night of Drinking, 2 drinks max', target: 'x1 max' },
            { category: 'Physical Health', name: '2 Strength Training', target: 'x2' },
            { category: 'Physical Health', name: '2 Cardio Training (1 swim)', target: 'x2' },
            { category: 'Physical Health', name: '10 Min Stretching/Mobility', target: 'daily' },
            { category: 'Physical Health', name: 'Core Work Out x1 (can be cardio focused core)', target: 'x1' },
            // Budgeting
            { category: 'Budgeting', name: 'Buy breakfast x1/week', target: 'x1' },
            { category: 'Budgeting', name: 'Buy lunch max x2/weekdays', target: 'x2' },
            { category: 'Budgeting', name: 'Buy dinner max x2/weekdays', target: 'x2' },
            { category: 'Budgeting', name: 'Buy lunch max x1/weekend', target: 'x1' },
            { category: 'Budgeting', name: 'Buy dinner max x1/weekend', target: 'x1' },
            { category: 'Budgeting', name: 'Sunday Money Date with Chelsey', target: 'weekly' },
            // Work
            { category: 'Work', name: 'Begin active work by 9:30AM each day', target: 'daily' },
            { category: 'Work', name: 'Time block each day', target: 'daily' },
            { category: 'Work', name: '90 min focused DND work OR 4 pomodoro blocks', target: 'daily' },
            { category: 'Work', name: '15 min AI training', target: 'daily' },
            { category: 'Work', name: 'Information System: Daily synthesis review', target: 'daily' },
            { category: 'Work', name: 'Information System: Weekly quiz', target: 'weekly' },
            // Monthly
            { category: 'Monthly', name: 'Review financial health (expenses, savings)', target: 'monthly' },
            { category: 'Monthly', name: 'Check-in with Chelsey on relationship', target: 'monthly' },
            { category: 'Monthly', name: '1 networking event', target: 'monthly' },
            { category: 'Monthly', name: '2 nice planned date nights', target: 'monthly' },
            // Cooking
            { category: 'Cooking', name: 'Cook 1 new meal/week', target: 'weekly' },
            { category: 'Cooking', name: 'Read 10 pages of cookbook/week', target: 'weekly' },
        ];
    }

    getDefaultHabits() {
        return [
            // Morning Protocol
            { id: 'am1', name: 'Phone away/airplane on wake', frequency: 'daily', category: 'morning' },
            { id: 'am2', name: 'Up by 7:15AM', frequency: 'weekdays', category: 'morning' },
            { id: 'am3', name: 'Hydrate 20oz immediately', frequency: 'daily', category: 'morning' },
            { id: 'am4', name: 'High protein/fat breakfast', frequency: 'daily', category: 'morning' },
            { id: 'am5', name: 'Skincare AM', frequency: 'daily', category: 'morning' },
            { id: 'am6', name: 'Caffeine delay 60 min', frequency: 'daily', category: 'morning' },
            { id: 'am7', name: 'Outdoor exposure 10-20 min', frequency: 'daily', category: 'morning' },
            // Midday Protocol
            { id: 'mid1', name: 'Cold shower finish 60s', frequency: 'weekly', category: 'midday' },
            { id: 'mid2', name: 'NSDR 10-20 min', frequency: 'daily', category: 'midday' },
            // Evening Protocol
            { id: 'pm1', name: 'Review expenses 5 min', frequency: 'daily', category: 'evening' },
            { id: 'pm2', name: 'Skincare PM', frequency: 'daily', category: 'evening' },
            { id: 'pm3', name: 'Phone parked before wind-down', frequency: 'daily', category: 'evening' },
            { id: 'pm4', name: 'Gratitude Journal', frequency: 'daily', category: 'evening' },
            { id: 'pm5', name: 'Read before bed', frequency: 'daily', category: 'evening' },
            { id: 'pm6', name: 'Meditate (3-5 min, long exhales)', frequency: 'daily', category: 'evening' },
            { id: 'pm7', name: 'Review strikes', frequency: 'daily', category: 'evening' },
            { id: 'pm8', name: 'In bed by 11:15PM', frequency: 'weekdays', category: 'evening' },
            { id: 'pm9', name: 'Stoic Review + Tomorrow\'s To-Do', frequency: 'daily', category: 'evening' },
        ];
    }

    loadData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return this.normalizeData(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
        return this.getDefaultData();
    }

    // Fill in missing top-level keys and settings. Run on anything assigned to this.data.
    normalizeData(data) {
        const defaults = this.getDefaultData();
        for (const key of Object.keys(defaults)) {
            if (!(key in data)) data[key] = defaults[key];
        }
        if (!data.settings.scoringCutover) data.settings.scoringCutover = DEFAULT_SCORING_CUTOVER;
        return data;
    }

    saveData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Error saving data:', e);
            alert('Warning: Could not save data. LocalStorage may be full.');
        }
        // Mirror to Convex in the background — no await, local save already done
        if (this.convex) this.convex.save(this.data);
    }

    logActivity(text) {
        this.data.activityLog.unshift({
            text,
            time: new Date().toISOString()
        });
        if (this.data.activityLog.length > 50) {
            this.data.activityLog = this.data.activityLog.slice(0, 50);
        }
        this.saveData();
    }

    // ========================================
    // Initialization
    // ========================================
    init() {
        this.bindAppearance();
        this.applyChartTheme();
        this.bindTyping();
        this.bindNavigation();
        this.bindModals();
        this.bindForms();
        this.bindQuickActions();
        this.bindHealthLog();
        this.bindWorkout();
        this.bindHabits();
        this.bindJournal();
        this.bindReview();
        this.bindGoals();
        this.bindSettings();
        this.bindMobileMenu();
        this.bindCatchUp();
        this.bindAppLifecycle();
        this.bindMeditation();

        // Ensure at least one week exists
        if (this.data.weeks.length === 0) {
            this.createNewWeek();
        }

        // After local render, pull fresher data from Convex
        if (this.convex) {
            this.convex.load().then(remote => {
                if (remote) {
                    const remoteWeeks = (remote.weeks || []).length;
                    const localWeeks = (this.data.weeks || []).length;
                    if (remoteWeeks >= localWeeks) {
                        this.data = this.normalizeData(remote);
                        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                        this.renderAll();
                    }
                }
                this.convex.subscribe((payload) => {
                    this.data = this.normalizeData(payload);
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                    this.renderAll();
                });
                this.updateConvexStatusUI();
                this.maybeShowCatchUp(); // after the freshest data is in
                this.syncSleep(true);
            });
        }

        this.renderDashboard();
        this.renderGoals();
        this.renderHealth();
        this.renderHabits();
        this.renderJournal();
        this.renderReview();

        // Set dashboard date
        document.getElementById('dashboardDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // On mobile, default to Today tab instead of Dashboard
        if (window.innerWidth <= 768) {
            this.navigateTo('habits');
        }

        // Notification taps open ?section=habits
        this.openSectionFromUrl();
        if (!this.convex) this.maybeShowCatchUp();
    }

    openSectionFromUrl() {
        const params = new URLSearchParams(location.search);
        const section = params.get('section');
        if (!section || !document.getElementById(`section-${section}`)) return;
        this.navigateTo(section);
        params.delete('section');
        const query = params.toString();
        history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
    }

    bindAppLifecycle() {
        // The service worker asks an already-open window to show a section (notification tap)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (e) => {
                if (e.data?.type === 'navigate' && e.data.section) this.navigateTo(e.data.section);
            });
            navigator.serviceWorker.startMessages();
        }
        // Home Screen apps resume from memory — refresh when the day has rolled over
        this._renderedDay = this.localDateKey(new Date());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            const day = this.localDateKey(new Date());
            if (day !== this._renderedDay) {
                this._renderedDay = day;
                this.renderAll();
            }
            this.maybeShowCatchUp(); // once a day, after the late-night hours
            this.updateAppBadge();
        });
    }

    // Home Screen icon badge = scheduled daily items still unchecked today
    updateAppBadge() {
        if (!('setAppBadge' in navigator)) return;
        const n = this.todayRemainingCount();
        const p = n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge();
        if (p && p.catch) p.catch(() => {});
    }

    // ========================================
    // Yesterday catch-up
    // ========================================
    bindCatchUp() {
        document.getElementById('catchUpList').addEventListener('click', (e) => {
            const item = e.target.closest('.catchup-item');
            if (!item) return;
            const box = item.querySelector('.habit-checkbox');
            const on = !box.classList.contains('checked');
            box.classList.toggle('checked', on);
            box.textContent = on ? '\u2713' : '';
            item.classList.toggle('item-done', on);
        });
        document.getElementById('catchUpDoneBtn').addEventListener('click', () => this.finishCatchUp());
    }

    // Once a day, offer to check off yesterday's scheduled daily items that are still blank
    maybeShowCatchUp() {
        if (this.isLateNight()) return; // yesterday is still open for a late reflection or meditation
        const todayKey = this.localDateKey(new Date());
        try {
            if (localStorage.getItem('lifeOS_catchUpShown') === todayKey) return;
        } catch (e) { /* storage unavailable — show anyway */ }
        const yesterday = this.startOfToday();
        yesterday.setDate(yesterday.getDate() - 1);
        const week = this.getWeekForDate(yesterday);
        if (!week || !this.isCutoverWeek(week)) return;
        const items = this.uncheckedDailyEntries(week, yesterday.getDay());
        if (items.length === 0) return;
        try { localStorage.setItem('lifeOS_catchUpShown', todayKey); } catch (e) { /* ignore */ }

        this._catchUpDate = yesterday;
        this._catchUpNames = items.map(i => i.entry.goal.name);
        document.getElementById('catchUpDate').textContent = yesterday.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });
        document.getElementById('catchUpList').innerHTML = items.map(({ entry }, i) => `
            <div class="habit-check-item catchup-item" data-catchup-idx="${i}">
                <div class="habit-checkbox"></div>
                <div class="habit-item-content">
                    <span class="habit-name">${this.escapeHtml(entry.goal.name)}</span>
                    <span class="off-reason">${this.escapeHtml(entry.goal.category)}</span>
                </div>
            </div>`).join('');
        this.openModal('catchUpModal');
    }

    finishCatchUp() {
        const names = [...document.querySelectorAll('#catchUpList .catchup-item')]
            .filter(el => el.querySelector('.habit-checkbox.checked'))
            .map(el => this._catchUpNames[parseInt(el.dataset.catchupIdx)]);
        // Look the week up again — a Convex sync may have replaced this.data meanwhile
        const day = this._catchUpDate;
        const week = day && this.getWeekForDate(day);
        if (week && names.length > 0) {
            const d = day.getDay();
            Object.values(week.entries).forEach(e => {
                if (names.includes(e.goal.name) && !this.isDone(e.tracking[d])) e.tracking[d] = 'X';
            });
            this.saveData();
            this.logActivity(`Caught up on yesterday: ${names.length} item${names.length > 1 ? 's' : ''} done`);
            this.renderAll();
        }
        this.closeModal('catchUpModal');
    }

    renderAll() {
        this.renderDashboard();
        this.renderGoals();
        this.renderHealth();
        this.renderHabits();
        this.renderJournal();
        this.renderReview();
    }

    // ========================================
    // Navigation
    // ========================================
    bindNavigation() {
        // Sidebar nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.navigateTo(section);
            });
        });

        // Mobile bottom nav buttons
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                this.navigateTo(section);
            });
        });
    }

    navigateTo(section) {
        // Update sidebar nav
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-section="${section}"]`).classList.add('active');

        // Update mobile bottom nav
        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        const mobileBtn = document.querySelector(`.mobile-nav-btn[data-section="${section}"]`);
        if (mobileBtn) mobileBtn.classList.add('active');

        // Update sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');

        // Close mobile menu
        document.getElementById('sidebar').classList.remove('open');

        // Scroll to top on mobile
        window.scrollTo(0, 0);
        // Growing text boxes can only be measured once their section is showing
        document.querySelectorAll(`#section-${section} textarea.autogrow`).forEach(el => this.autoGrow(el));

        // Refresh the section
        switch (section) {
            case 'dashboard': this.renderDashboard(); break;
            case 'goals': this.renderGoals(); break;
            case 'health': this.renderHealth(); break;
            case 'habits': this.renderHabits(); break;
            case 'journal': this.renderJournal(); break;
            case 'review': this.renderReview(); break;
            case 'meditate': this.renderMeditation(); break;
        }
    }

    bindMobileMenu() {
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Close sidebar on clicking outside on mobile
        document.getElementById('mainContent').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    }

    // ========================================
    // Modals
    // ========================================
    bindModals() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal;
                document.getElementById(modalId).classList.remove('active');
            });
        });

        // Close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    // ========================================
    // Week Management
    // ========================================
    getWeekStartDate(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day); // Go to Sunday
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // Returns 'YYYY-MM-DD' for the Sunday of the week containing the given date
    weekKey(date) {
        return this.getWeekStartDate(date).toISOString().slice(0, 10);
    }

    createNewWeek() {
        const startDate = this.getWeekStartDate();
        const key = this.weekKey(startDate);

        // Check if a week for this Sunday already exists (normalize by date only)
        const existing = this.data.weeks.find(w => this.weekKey(new Date(w.startDate)) === key);

        if (existing) {
            // If the existing week came from historical import and has no current goals,
            // update its startDate to match the app format and add current goals
            const hasCurrentGoals = this.data.goals.some(g =>
                Object.values(existing.entries).some(e => e.goal.name === g.name)
            );
            if (hasCurrentGoals) return; // Already set up — nothing to do

            // Add current goals that aren't already in the week
            const existingNames = new Set(Object.values(existing.entries).map(e => e.goal.name));
            const nextIdx = Object.keys(existing.entries).reduce((max, k) => Math.max(max, Number(k)), 0) + 1;
            this.data.goals.forEach((goal, i) => {
                if (!existingNames.has(goal.name)) {
                    existing.entries[nextIdx + i] = {
                        goal: { ...goal },
                        tracking: ['', '', '', '', '', '', '']
                    };
                }
            });
            this.saveData();
            this.logActivity('Added current goals to existing week');
            return;
        }

        const week = {
            startDate: startDate.toISOString(),
            entries: {}
        };

        this.data.goals.forEach((goal, i) => {
            week.entries[i] = {
                goal: { ...goal },
                tracking: ['', '', '', '', '', '', '']
            };
        });

        this.data.weeks.push(week);
        // Keep weeks sorted by date
        this.data.weeks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        this.saveData();
        this.logActivity('New week started');
    }

    getCurrentWeek() {
        if (this.data.weeks.length === 0) return null;
        if (this.currentWeekIndex === -1) {
            return this.data.weeks[this.data.weeks.length - 1];
        }
        return this.data.weeks[this.currentWeekIndex];
    }

    // Always returns the week that contains today (for the Today/habits section).
    // Falls back to the most recent week if today doesn't fall in any stored week.
    getTodayWeek() {
        if (this.data.weeks.length === 0) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Search from most recent backward
        for (let i = this.data.weeks.length - 1; i >= 0; i--) {
            const w = this.data.weeks[i];
            const start = new Date(w.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            if (today >= start && today <= end) return w;
        }
        // No exact match — return the most recent week
        return this.data.weeks[this.data.weeks.length - 1];
    }

    formatWeekDate(isoStr) {
        const d = new Date(isoStr);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        return `${d.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
    }

    // ========================================
    // Tracking Helpers (skipped cells, per-goal schedules)
    // ========================================
    // Cell values: 'X' done, '1'/'2'.. strikes, '-' skipped (doesn't apply), '' untracked
    isTracked(v) {
        return v !== '' && v !== '-' && v != null;
    }

    getVacationDays(week) {
        return week.vacationDays || (week.vacation ? [0, 1, 2, 3, 4, 5, 6] : []);
    }

    // Days of the week (0=Sun..6=Sat) a goal applies to. The schedule lives on the goal
    // in this.data.goals (matched by name) so it applies to every week, past and future;
    // otherwise derive from the target. Weeknights = Sun-Thu (nights before a workday).
    getGoalDays(goal) {
        const current = this.data.goals.find(g => g.name === goal.name);
        const days = current?.days ?? goal.days;
        if (Array.isArray(days)) return days;
        const t = (goal.target || '').toLowerCase().trim();
        if (t === 'weekdays') return [1, 2, 3, 4, 5];
        if (t === 'weeknights') return [0, 1, 2, 3, 4];
        return [0, 1, 2, 3, 4, 5, 6];
    }

    // Is this goal expected on this day? False for vacation days, skipped cells,
    // and days outside the goal's schedule.
    isExpected(week, entry, dayIdx) {
        if (this.getVacationDays(week).includes(dayIdx)) return false;
        if (entry.tracking[dayIdx] === '-') return false;
        return this.getGoalDays(entry.goal).includes(dayIdx);
    }

    // Tick the day's cell for the goal whose name matches `pattern` (guided sessions and the
    // evening reflection check themselves off); false if this week has no such goal
    checkOffGoal(pattern, date = new Date()) {
        const week = this.getWeekForDate(date);
        const entry = week && Object.values(week.entries).find(e => pattern.test(e.goal.name));
        if (!entry) return false;
        entry.tracking[date.getDay()] = 'X';
        return true;
    }

    setGoalDays(goalIdx, days) {
        const goal = this.data.goals[goalIdx];
        if (goal) goal.days = [...days].sort();
    }

    // ========================================
    // Scoring (one rule for every %, strike count and chart)
    // ========================================
    isDone(v) {
        return v === 'X' || v === 'x';
    }

    // 'YYYY-MM-DD' in local time (toISOString would shift evenings into tomorrow)
    localDateKey(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    startOfToday() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    isLateNight(now = new Date()) {
        return now.getHours() < LATE_NIGHT_HOURS;
    }

    // The day a reflection or meditation counts for: yesterday until LATE_NIGHT_HOURS, else today (noon, clear of DST)
    reflectionDay(now = new Date()) {
        const d = new Date(now);
        if (this.isLateNight(d)) d.setDate(d.getDate() - 1);
        d.setHours(12, 0, 0, 0);
        return d;
    }

    // Reflect's theme for a day: the themes in turn, one a day, the same on every device. Before 3 AM it's
    // still the night before's theme, like the session's log date
    themeOfDay(themes, now = new Date()) {
        const n = Math.round(Date.parse(`${this.localDateKey(this.reflectionDay(now))}T12:00:00Z`) / 864e5);
        return themes[((n % themes.length) + themes.length) % themes.length];
    }

    // "today", or "Saturday" when it's past midnight and the late-night day is still open
    reflectionDayName(now = new Date()) {
        return this.dayWord(this.reflectionDay(now), now);
    }

    // "today" or the weekday ("Friday") for a day in the past week
    dayWord(day, now = new Date()) {
        return this.localDateKey(day) === this.localDateKey(now) ? 'today' : day.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // The day a saved reflection is for: its own date when written for an earlier day, else the day it was
    // saved (older entries' `date` could be a UTC day, so their timestamp wins)
    reflectionKey(r) {
        return r.backdated || !r.timestamp ? r.date : this.localDateKey(this.reflectionDay(new Date(r.timestamp)));
    }

    // Local midnight of the Sunday a stored week starts on. startDate is Sunday midnight
    // (or noon, for imports) in whatever timezone it was created; shifting by 12h first
    // keeps a few hours of timezone difference from landing it in the previous week.
    weekStartOf(week) {
        return this.getWeekStartDate(new Date(new Date(week.startDate).getTime() + 12 * 3600e3));
    }

    // Local midnight of day dayIdx (0=Sun) of a week
    weekDayDate(week, dayIdx) {
        const d = this.weekStartOf(week);
        d.setDate(d.getDate() + dayIdx);
        return d;
    }

    // The stored week containing date, or null (no fallback to another week)
    getWeekForDate(date) {
        const key = this.localDateKey(this.getWeekStartDate(date));
        for (let i = this.data.weeks.length - 1; i >= 0; i--) {
            if (this.localDateKey(this.weekStartOf(this.data.weeks[i])) === key) return this.data.weeks[i];
        }
        return null;
    }

    isCutoverWeek(week) {
        const cutover = this.data.settings?.scoringCutover || DEFAULT_SCORING_CUTOVER;
        return this.localDateKey(this.weekStartOf(week)) >= cutover;
    }

    hasCustomDays(goal) {
        const current = this.data.goals.find(g => g.name === goal.name);
        return Array.isArray(current?.days ?? goal.days);
    }

    // Which scoring rule a goal follows: 'limit' | 'monthly' | 'daily' | 'perWeek'
    scoringKind(goal) {
        const freq = this.classifyFrequency(goal.target);
        if (freq.isLimit || (goal.category || '').trim() === 'Budgeting') return 'limit';
        if (freq.group === 'monthly') return 'monthly';
        if (freq.group === 'daily' || this.hasCustomDays(goal)) return 'daily';
        return 'perWeek';
    }

    // Was a monthly goal checked on any day of the given month (any week)?
    isMonthlyDone(goalName, year, month) {
        return this.data.weeks.some(week => {
            const entry = Object.values(week.entries).find(e => e.goal.name === goalName);
            if (!entry) return false;
            return entry.tracking.some((v, d) => {
                if (!this.isDone(v)) return false;
                const date = this.weekDayDate(week, d);
                return date.getFullYear() === year && date.getMonth() === month;
            });
        });
    }

    // Score one goal for one week → { done, expected, misses, ... }.
    // done/expected feed every %; misses (incl. manual +/− adjustments) feed every strike count.
    // Weeks before the cutover: ✓ ÷ marked cells, explicit strikes only.
    // From the cutover on, only ✓ is entered and misses are inferred:
    //   daily    — each scheduled day that has passed and is still blank is a miss (today never is)
    //   perWeek  — only ✓ count; a shortfall counts once the week is over (until then the goal
    //              is left out unless the target is already met)
    //   limit    — ✓ = used one; at/under the limit = 100%, each use over = a miss
    //   monthly  — judged at month end, in the week holding the month's last day
    // Skipped '-', unscheduled and vacation days are excluded. Explicit ✗ still counts as a miss.
    scoreEntry(week, entry) {
        const t = entry.tracking || [];
        const vac = this.getVacationDays(week);
        const days = [0, 1, 2, 3, 4, 5, 6].filter(d => !vac.includes(d));
        const explicit = days.reduce((n, d) => n + (parseInt(t[d]) || 0), 0);
        const checks = days.filter(d => this.isDone(t[d])).length;
        const withManual = n => Math.max(0, n + (entry.manual || 0));

        const target = Math.round(this.classifyFrequency(entry.goal.target).perWeek);

        if (!this.isCutoverWeek(week)) {
            const marked = days.filter(d => this.isTracked(t[d])).length;
            return { kind: 'legacy', done: checks, expected: marked, misses: withManual(explicit), checks, target };
        }

        const kind = this.scoringKind(entry.goal);
        const today = this.startOfToday();
        const weekOver = this.weekDayDate(week, 6) < today;

        if (kind === 'daily') {
            let done = 0, expected = 0, inferred = 0;
            for (let d = 0; d < 7; d++) {
                if (!this.isExpected(week, entry, d)) continue;
                const v = t[d] ?? '';
                if (this.isDone(v)) { done++; expected++; }
                else if (parseInt(v) > 0) expected++; // explicit ✗, already in `explicit`
                else if (this.weekDayDate(week, d) < today) { expected++; inferred++; }
            }
            return { kind, done, expected, misses: withManual(explicit + inferred), checks, target: expected };
        }

        // Days the goal could still happen on (vacation and skipped days removed)
        const available = days.filter(d => t[d] !== '-').length;

        if (kind === 'limit') {
            if (available === 0) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target };
            const over = Math.max(0, checks - target);
            const missed = Math.max(explicit, over);
            return { kind, done: Math.max(0, target - missed), expected: target, misses: withManual(missed), checks, target };
        }

        if (kind === 'monthly') {
            const endDay = [0, 1, 2, 3, 4, 5, 6].find(d => {
                const next = this.weekDayDate(week, d + 1);
                return next.getDate() === 1;
            });
            if (endDay === undefined) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 0 };
            const end = this.weekDayDate(week, endDay);
            if (this.isMonthlyDone(entry.goal.name, end.getFullYear(), end.getMonth())) {
                return { kind, done: 1, expected: 1, misses: withManual(explicit), checks, target: 1 };
            }
            if (end >= today) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 1, pending: true };
            return { kind, done: 0, expected: 1, misses: withManual(Math.max(explicit, 1)), checks, target: 1 };
        }

        // perWeek: x2, x3, weekly, x1 — target shrinks if vacation/skips leave fewer days
        const need = Math.min(target, available);
        if (need === 0) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 0 };
        if (checks >= need) return { kind, done: need, expected: need, misses: withManual(explicit), checks, target: need };
        if (!weekOver) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: need, pending: true };
        return { kind, done: checks, expected: need, misses: withManual(Math.max(explicit, need - checks)), checks, target: need };
    }

    // Sum scoreEntry over a week's entries, optionally filtered
    scoreWeek(week, filter = () => true) {
        const total = { done: 0, expected: 0, misses: 0 };
        Object.values(week.entries).forEach(entry => {
            if (!filter(entry)) return;
            const s = this.scoreEntry(week, entry);
            total.done += s.done;
            total.expected += s.expected;
            total.misses += s.misses;
        });
        return total;
    }

    // { category: { done, expected, misses } } for one week
    scoreByCategory(week) {
        const cats = {};
        Object.values(week.entries).forEach(entry => {
            const cat = entry.goal.category;
            if (!cats[cat]) cats[cat] = { done: 0, expected: 0, misses: 0 };
            const s = this.scoreEntry(week, entry);
            cats[cat].done += s.done;
            cats[cat].expected += s.expected;
            cats[cat].misses += s.misses;
        });
        return cats;
    }

    scorePct(s) {
        return s.expected > 0 ? Math.min(100, Math.round((s.done / s.expected) * 100)) : 0;
    }

    // Is this cell an inferred miss (blank on a scheduled day that has passed)?
    isInferredMiss(week, entry, dayIdx) {
        return this.isCutoverWeek(week) &&
            this.scoringKind(entry.goal) === 'daily' &&
            (entry.tracking[dayIdx] ?? '') === '' &&
            this.isExpected(week, entry, dayIdx) &&
            this.weekDayDate(week, dayIdx) < this.startOfToday();
    }

    // Scheduled daily items on dayIdx of week that are still blank
    uncheckedDailyEntries(week, dayIdx) {
        return Object.entries(week.entries)
            .filter(([, e]) => this.scoringKind(e.goal) === 'daily' &&
                this.isExpected(week, e, dayIdx) &&
                (e.tracking[dayIdx] ?? '') === '')
            .map(([idx, e]) => ({ idx, entry: e }));
    }

    todayRemainingCount() {
        const today = this.startOfToday();
        const week = this.getWeekForDate(today);
        return week ? this.uncheckedDailyEntries(week, today.getDay()).length : 0;
    }

    // Theme color from life-os.css (charts can't read CSS variables themselves)
    themeColor(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    }

    // ---- Appearance (night mode) ----
    // 'auto' follows the phone's Dark Mode; 'light' / 'dark' pin it. Per device.
    themeChoice() {
        const t = this.getLocal('lifeOS_theme');
        return t === 'light' || t === 'dark' ? t : 'auto';
    }

    isDarkTheme() {
        const choice = this.themeChoice();
        if (choice !== 'auto') return choice === 'dark';
        return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    }

    bindAppearance() {
        this.applyTheme();
        document.getElementById('themeChoice').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-theme-choice]');
            if (btn) this.setTheme(btn.dataset.themeChoice);
        });
        // In Auto, follow the phone switching at sunset/sunrise while the app is open
        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
            if (this.themeChoice() === 'auto') this.applyTheme(true);
        });
    }

    setTheme(choice) {
        this.setLocal('lifeOS_theme', choice === 'light' || choice === 'dark' ? choice : '');
        this.applyTheme(true);
    }

    // Set data-theme, the status bar colour and the switch; redraw charts if asked
    applyTheme(redraw = false) {
        const choice = this.themeChoice();
        const root = document.documentElement;
        if (choice === 'auto') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', choice);
        const bg = this.themeColor('bg');
        document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
            // A pinned choice overrides both media variants; Auto restores them
            meta.content = choice === 'auto'
                ? (meta.media.includes('dark') ? '#15171b' : '#f6f4ef')
                : bg;
        });
        document.querySelectorAll('#themeChoice [data-theme-choice]').forEach(b => {
            const on = b.dataset.themeChoice === choice;
            b.classList.toggle('active', on);
            b.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        if (redraw) {
            this.applyChartTheme();
            this.renderAll(); // charts read colours when they're drawn
        }
    }

    // ---- Typing on a phone ----
    // Text boxes grow with what you write, the tab bar steps aside for the keyboard, and the
    // field you're in stays visible above it.
    bindTyping() {
        const isTextField = el => !!el?.matches?.('textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit])');
        document.addEventListener('input', (e) => {
            if (e.target.matches?.('textarea.autogrow')) this.autoGrow(e.target, true);
        });
        document.addEventListener('focusin', (e) => {
            if (!isTextField(e.target)) return;
            document.body.classList.add('typing');
            clearTimeout(this._typingScroll);
            this._typingScroll = setTimeout(() => this.keepFieldVisible(e.target), 350); // after the keyboard is up
        });
        document.addEventListener('focusout', () => {
            // Focus may just be moving to the next field
            setTimeout(() => { if (!isTextField(document.activeElement)) document.body.classList.remove('typing'); }, 60);
        });
    }

    autoGrow(el, followCaret = false) {
        if (!el.offsetParent) return; // hidden: sized when its section opens
        const y = window.scrollY;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
        if (window.scrollY !== y) window.scrollTo(0, y); // shrinking to 'auto' for a moment can jump the page
        if (followCaret && el.selectionEnd === el.value.length) this.keepFieldVisible(el, true);
    }

    // Scroll so the field (or, while typing at its end, its last line) sits between the header and the keyboard
    keepFieldVisible(el, lastLine = false) {
        if (document.activeElement !== el || el.closest('.modal') || !window.matchMedia?.('(max-width: 768px)').matches) return;
        const vv = window.visualViewport;
        const top = (vv?.offsetTop || 0) + (document.querySelector('.mobile-header')?.offsetHeight || 0) + 8;
        const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - 12;
        const rect = el.getBoundingClientRect();
        if (lastLine) {
            if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
        } else if (rect.top < top) {
            window.scrollBy(0, rect.top - top);
        } else if (rect.bottom > bottom) {
            window.scrollBy(0, Math.min(rect.bottom - bottom, rect.top - top));
        }
    }

    // Quiet chart defaults to match the paper theme
    applyChartTheme() {
        if (!window.Chart || !Chart.defaults) return;
        Chart.defaults.font.family = this.themeColor('font-sans');
        Chart.defaults.color = this.themeColor('text-muted');
        Chart.defaults.borderColor = this.themeColor('border-light');
    }

    // ========================================
    // Dashboard
    // ========================================
    renderDashboard() {
        this.updateAppBadge();
        this.renderLifeScore();
        this.renderDashStats();
        this.renderWeeklyTrend();
        this.renderCategoryBars();
        this.renderProblemAreas();
        this.renderAllTimeStats();
        this.renderDeepDive();
        this.renderActivityFeed();
    }

    renderLifeScore() {
        const week = this.getCurrentWeek();
        if (!week) return;

        const goalStats = this.scoreWeek(week);

        // Factor in habits
        const today = this.getTodayStr();
        const todayHabits = this.data.habitLog[today] || {};
        const habitsDone = Object.values(todayHabits).filter(v => v).length;
        const habitsTotal = this.data.habits.length;

        // Weighted score: 60% goals, 25% habits, 15% other factors
        const goalScore = goalStats.expected > 0 ? (goalStats.done / goalStats.expected) * 100 : 0;
        const habitScore = habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0;
        const lifeScore = Math.round(goalScore * 0.6 + habitScore * 0.25 + 15); // 15 base points

        document.getElementById('lifeScoreValue').textContent = Math.min(lifeScore, 100);

        // Draw ring chart
        const canvas = document.getElementById('lifeScoreChart');
        if (this.charts.lifeScore) this.charts.lifeScore.destroy();
        this.charts.lifeScore = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [Math.min(lifeScore, 100), Math.max(100 - lifeScore, 0)],
                    backgroundColor: [this.themeColor('primary'), this.themeColor('border-light')],
                    borderWidth: 0,
                }]
            },
            options: {
                cutout: '78%',
                responsive: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { animateRotate: true }
            }
        });
    }

    renderDashStats() {
        const week = this.getCurrentWeek();
        if (!week) return;

        // Goals on track
        let onTrack = 0;
        const totalGoals = Object.keys(week.entries).length;
        Object.values(week.entries).forEach(entry => {
            if (this.scoreEntry(week, entry).misses === 0) onTrack++;
        });
        document.getElementById('dashGoalsOnTrack').textContent = onTrack;
        document.getElementById('dashGoalsDetail').textContent = `of ${totalGoals} goals`;

        // Today's progress
        const todayDayIdx = new Date().getDay();
        let todayDone = 0, todayTotal = 0;
        if (week) {
            Object.values(week.entries).forEach(entry => {
                const freq = this.classifyFrequency(entry.goal.target);
                // Only count items applicable today
                const applicable = (freq.group === 'daily' || freq.group === 'fewPerWeek') &&
                    this.scoringKind(entry.goal) !== 'limit' &&
                    this.isExpected(week, entry, todayDayIdx);
                if (applicable) {
                    todayTotal++;
                    const val = entry.tracking[todayDayIdx];
                    if (val === 'X' || val === 'x') todayDone++;
                }
            });
        }
        document.getElementById('dashTodayProgress').textContent = `${todayDone}/${todayTotal}`;
        document.getElementById('dashTodayDetail').textContent = 'items done today';

        // Health score (based on physical health goal completion this week)
        const healthPct = this.scorePct(this.scoreWeek(week, e =>
            e.goal.category === 'Physical Health' || e.goal.category === 'Mental Health'));
        document.getElementById('dashHealthScore').textContent = healthPct + '%';

        // Habit streak
        const streak = this.calculateMaxStreak();
        document.getElementById('dashHabitStreak').textContent = streak;
    }

    calculateMaxStreak() {
        // Count consecutive days (including today) where ≥70% of daily goals were completed
        const sortedWeeks = [...this.data.weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        if (sortedWeeks.length === 0) return 0;

        const today = new Date();
        const todayDayIdx = today.getDay();
        let streak = 0;
        let weekIdx = sortedWeeks.length - 1;
        let dayIdx = todayDayIdx;

        while (weekIdx >= 0) {
            const week = sortedWeeks[weekIdx];
            const entries = Object.values(week.entries).filter(e => {
                const freq = this.classifyFrequency(e.goal.target);
                return freq.group === 'daily';
            });
            if (entries.length === 0) break;

            for (let d = dayIdx; d >= 0; d--) {
                // Only goals expected that day count; days with nothing expected are skipped
                const expected = entries.filter(e => this.isExpected(week, e, d));
                if (expected.length === 0) continue;
                const done = expected.filter(e => e.tracking[d] === 'X' || e.tracking[d] === 'x').length;
                if (done / expected.length >= 0.7) {
                    streak++;
                } else if (weekIdx === sortedWeeks.length - 1 && d === todayDayIdx) {
                    continue; // today is still in progress — don't break the streak yet
                } else {
                    return streak;
                }
            }
            weekIdx--;
            dayIdx = 6;
        }
        return streak;
    }

    renderCategoryBars() {
        const week = this.getCurrentWeek();
        const container = document.getElementById('dashCategoryBars');
        if (!week) {
            container.innerHTML = '<div class="empty-state">No data yet.</div>';
            return;
        }

        const catStats = this.scoreByCategory(week);

        let html = '';
        for (const [cat, stats] of Object.entries(catStats)) {
            const pct = this.scorePct(stats);
            html += `
                <div class="category-bar-item">
                    <div class="category-bar-label">
                        <span>${cat}</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="category-bar-track">
                        <div class="category-bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>`;
        }
        container.innerHTML = html;
    }

    renderWeeklyTrend() {
        const el = document.getElementById('weeklyTrend');
        if (!el) return;
        const sorted = [...this.data.weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        if (sorted.length < 2) { el.textContent = ''; return; }

        const getScore = (week) => this.scorePct(this.scoreWeek(week));

        const curr = getScore(sorted[sorted.length - 1]);
        const prev = getScore(sorted[sorted.length - 2]);
        const diff = curr - prev;

        if (diff > 0) { el.textContent = `↑ ${diff}% vs last week`; el.className = 'weekly-trend up'; }
        else if (diff < 0) { el.textContent = `↓ ${Math.abs(diff)}% vs last week`; el.className = 'weekly-trend down'; }
        else { el.textContent = '→ Same as last week'; el.className = 'weekly-trend neutral'; }
    }

    renderProblemAreas() {
        const container = document.getElementById('problemAreas');
        if (!container) return;
        const week = this.getCurrentWeek();
        if (!week) { container.innerHTML = ''; return; }

        const catStats = this.scoreByCategory(week);

        const worst = Object.entries(catStats)
            .filter(([, s]) => s.expected > 0)
            .map(([cat, s]) => ({ cat, pct: this.scorePct(s), strikes: s.misses }))
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 3)
            .filter(s => s.pct < 80);

        if (worst.length === 0) { container.innerHTML = ''; return; }

        container.innerHTML = `
            <div class="problem-areas">
                <h3>Needs Attention This Week</h3>
                <div class="problem-areas-list">
                    ${worst.map(s => `
                        <div class="problem-area-item">
                            <div class="problem-area-header">
                                <span class="problem-area-name">${s.cat}</span>
                                <span class="problem-area-pct" style="color:${s.pct < 50 ? 'var(--danger)' : 'var(--warning)'}">${s.pct}%${s.strikes > 0 ? ` · ${s.strikes} strike${s.strikes > 1 ? 's' : ''}` : ''}</span>
                            </div>
                            <div class="problem-bar-track">
                                <div class="problem-bar-fill" style="width:${s.pct}%;background:${s.pct < 50 ? 'var(--danger)' : 'var(--warning)'}"></div>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
    }

    renderAllTimeStats(period) {
        const container = document.getElementById('allTimeStats');
        if (!container) return;
        if (this.data.weeks.length <= 1) { container.style.display = 'none'; return; }
        container.style.display = 'block';

        if (!period) period = this.allStatsPeriod || 'all';
        this.allStatsPeriod = period;

        const now = new Date();
        const periodCutoff = {
            '1m':  new Date(now - 30 * 864e5),
            '3m':  new Date(now - 91 * 864e5),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[period];
        const weeks = this.data.weeks.filter(w => new Date(w.startDate) >= periodCutoff);

        const catStats = {};   // cat -> { done, strikes, total, weekCount: Set, goals: { name -> {done,strikes,total} } }
        weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                const cat = (entry.goal.category || 'Other').trim();
                if (EXCLUDE_CATS.has(cat.toLowerCase())) return;
                if (!catStats[cat]) catStats[cat] = { done: 0, strikes: 0, total: 0, weekCount: new Set(), goals: {} };
                const cStat = catStats[cat];
                cStat.weekCount.add(week.startDate);
                const gName = entry.goal.name;
                if (!cStat.goals[gName]) cStat.goals[gName] = { done: 0, strikes: 0, total: 0 };
                const gStat = cStat.goals[gName];
                const s = this.scoreEntry(week, entry);
                cStat.total += s.expected; gStat.total += s.expected;
                cStat.done += s.done; gStat.done += s.done;
                cStat.strikes += s.misses; gStat.strikes += s.misses;
            });
        });

        // Filter out categories with very little data (< 20 tracked instances)
        const sorted = Object.entries(catStats)
            .filter(([, s]) => s.total >= 20)
            .sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));

        if (sorted.length === 0) { container.style.display = 'none'; return; }

        const cards = sorted.map(([cat, s]) => {
            const pct = Math.round((s.done / s.total) * 100);
            const cls = pct >= 80 ? 'good' : pct >= 60 ? 'okay' : 'needs-work';
            const wks = s.weekCount.size;

            // Top goals by frequency (most tracked), show pct for each
            const topGoals = Object.entries(s.goals)
                .filter(([, g]) => g.total >= 5)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5)
                .map(([name, g]) => {
                    const gpct = Math.round((g.done / g.total) * 100);
                    const gcls = gpct >= 80 ? 'var(--success)' : gpct >= 60 ? 'var(--warning)' : 'var(--danger)';
                    return `<div class="alltime-goal-row">
                        <span class="alltime-goal-name">${this.escapeHtml(name)}</span>
                        <span class="alltime-goal-pct" style="color:${gcls}">${gpct}%</span>
                    </div>`;
                }).join('');

            return `<div class="alltime-cat-card ${cls}">
                <div class="alltime-cat-header">
                    <span class="alltime-cat-name">${cat}</span>
                    <span class="alltime-cat-pct">${pct}%</span>
                </div>
                <div class="alltime-cat-detail">${s.done}✓ · ${s.strikes > 0 ? s.strikes + '✗ · ' : ''}${wks}wks</div>
                ${topGoals ? `<div class="alltime-goals-list">${topGoals}</div>` : ''}
            </div>`;
        }).join('');

        const periodBtns = [
            { id: '1m', label: '1M' }, { id: '3m', label: '3M' },
            { id: 'ytd', label: 'YTD' }, { id: 'all', label: 'All' }
        ].map(p => `<button class="deepdive-period-btn allstats-period-btn${period === p.id ? ' active' : ''}" data-period="${p.id}">${p.label}</button>`).join('');

        container.innerHTML = `
            <div class="alltime-stats">
                <div class="alltime-header">
                    <h3>By Category <span class="alltime-weeks-label">${weeks.length} weeks</span></h3>
                    <div class="deepdive-period-filter">${periodBtns}</div>
                </div>
                <div class="alltime-grid">${cards}</div>
            </div>`;

        container.querySelectorAll('.allstats-period-btn').forEach(btn => {
            btn.addEventListener('click', () => this.renderAllTimeStats(btn.dataset.period));
        });
    }

    renderDeepDive(period) {
        const container = document.getElementById('deepDive');
        if (!container) return;
        if (this.data.weeks.length < 4) { container.style.display = 'none'; return; }
        container.style.display = 'block';

        // Preserve open/closed state across re-renders
        const wasOpen = document.getElementById('deepDiveBody')?.style.display !== 'none';
        if (!period) period = this.deepDivePeriod || 'all';
        this.deepDivePeriod = period;

        // Filter weeks by selected period
        const now = new Date();
        const periodCutoff = {
            '1m':  new Date(now - 30 * 864e5),
            '3m':  new Date(now - 91 * 864e5),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[period];
        const weeks = this.data.weeks.filter(w => new Date(w.startDate) >= periodCutoff);

        // ── Month-over-month bars ───────────────────────────────────────
        const monthStats = {};
        weeks.forEach(week => {
            const d = new Date(week.startDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthStats[key]) monthStats[key] = { done: 0, total: 0 };
            const s = this.scoreWeek(week);
            monthStats[key].done += s.done;
            monthStats[key].total += s.expected;
        });
        const monthKeys = Object.keys(monthStats).sort().slice(-12);
        const monthBars = monthKeys.map(key => {
            const s = monthStats[key];
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
            const monthName = new Date(key + '-15').toLocaleDateString('en-US', { month: 'short' });
            return `<div class="trend-bar-col">
                <div class="trend-bar-wrap">
                    <div class="trend-bar-fill" style="height:${pct}%;background:${color};" title="${pct}%"></div>
                </div>
                <div class="trend-bar-label">${monthName}</div>
            </div>`;
        }).join('');

        // ── Active streaks (always all-time — streaks are live) ─────────
        const goalNames = new Set();
        this.data.weeks.forEach(w => Object.values(w.entries).forEach(e => goalNames.add(e.goal.name)));
        const streaks = [...goalNames].map(name => ({ name, streak: this.calculateGoalStreak(name) }))
            .filter(g => g.streak >= 3).sort((a, b) => b.streak - a.streak).slice(0, 5);
        const streakRows = streaks.length ? streaks.map(g => {
            const badge = g.streak >= 30 ? '👑' : g.streak >= 14 ? '💎' : g.streak >= 7 ? '⭐' : '🔥';
            return `<div class="deepdive-row">
                <span class="deepdive-name">${this.escapeHtml(g.name)}</span>
                <span class="deepdive-val">${badge} ${g.streak}d</span>
            </div>`;
        }).join('') : '<div class="deepdive-empty">No active streaks ≥ 3 days</div>';

        // ── Top & bottom goals ──────────────────────────────────────────
        const goalStats = {};
        weeks.forEach(week => {
            Object.values(week.entries).forEach(entry => {
                const name = entry.goal.name;
                if (!goalStats[name]) goalStats[name] = { done: 0, total: 0 };
                const s = this.scoreEntry(week, entry);
                goalStats[name].done += s.done;
                goalStats[name].total += s.expected;
            });
        });
        const minTotal = period === '1m' ? 3 : 10;
        const rankedGoals = Object.entries(goalStats)
            .filter(([, s]) => s.total >= minTotal)
            .map(([name, s]) => ({ name, pct: Math.round((s.done / s.total) * 100) }))
            .sort((a, b) => b.pct - a.pct);
        const top5 = rankedGoals.slice(0, 5);
        const bot5 = rankedGoals.slice(-5).reverse();
        const goalRow = (g, colorVar) => `<div class="deepdive-row">
            <span class="deepdive-name">${this.escapeHtml(g.name)}</span>
            <span class="deepdive-val" style="color:${colorVar}">${g.pct}%</span>
        </div>`;

        const periods = [
            { id: '1m', label: '1M' },
            { id: '3m', label: '3M' },
            { id: 'ytd', label: 'YTD' },
            { id: 'all', label: 'All' }
        ];
        const filterBtns = periods.map(p =>
            `<button class="deepdive-period-btn${period === p.id ? ' active' : ''}" data-period="${p.id}">${p.label}</button>`
        ).join('');

        container.innerHTML = `
            <div class="deepdive-wrap">
                <button class="deepdive-toggle" id="deepDiveToggle">
                    <span>📊 Deep Dive</span>
                    <span class="deepdive-chevron" id="deepDiveChevron">${wasOpen ? '▼' : '▶'}</span>
                </button>
                <div class="deepdive-body" id="deepDiveBody" style="display:${wasOpen ? 'block' : 'none'};">
                    <div class="deepdive-period-filter">${filterBtns}</div>
                    <div class="deepdive-section">
                        <h4>Month-over-Month</h4>
                        <div class="trend-bars">${monthBars || '<span class="deepdive-empty">No data for this period</span>'}</div>
                    </div>
                    <div class="deepdive-cols">
                        <div class="deepdive-section">
                            <h4>Active Streaks</h4>
                            ${streakRows}
                        </div>
                        <div class="deepdive-section">
                            <h4>Best</h4>
                            ${top5.map(g => goalRow(g, 'var(--success)')).join('') || '<div class="deepdive-empty">Not enough data</div>'}
                        </div>
                        <div class="deepdive-section">
                            <h4>Needs Work</h4>
                            ${bot5.map(g => goalRow(g, 'var(--danger)')).join('') || '<div class="deepdive-empty">Not enough data</div>'}
                        </div>
                    </div>
                </div>
            </div>`;

        document.getElementById('deepDiveToggle').addEventListener('click', () => {
            const body = document.getElementById('deepDiveBody');
            const chevron = document.getElementById('deepDiveChevron');
            const open = body.style.display === 'none';
            body.style.display = open ? 'block' : 'none';
            chevron.textContent = open ? '▼' : '▶';
        });

        container.querySelectorAll('.deepdive-period-btn').forEach(btn => {
            btn.addEventListener('click', () => this.renderDeepDive(btn.dataset.period));
        });
    }

    renderActivityFeed() {
        const feed = document.getElementById('activityFeed');
        if (this.data.activityLog.length === 0) {
            feed.innerHTML = `<div class="activity-item">
                <span class="activity-dot"></span>
                <span class="activity-text">Welcome to Life OS. Start tracking to see activity here.</span>
                <span class="activity-time">just now</span>
            </div>`;
            return;
        }

        feed.innerHTML = this.data.activityLog.slice(0, 10).map(a => {
            const ago = this.timeAgo(new Date(a.time));
            return `<div class="activity-item">
                <span class="activity-dot"></span>
                <span class="activity-text">${this.escapeHtml(a.text)}</span>
                <span class="activity-time">${ago}</span>
            </div>`;
        }).join('');
    }

    // ========================================
    // Goals Section
    // ========================================
    bindGoals() {
        document.getElementById('prevWeekBtn').addEventListener('click', () => {
            const realIndex = this.currentWeekIndex === -1 ? this.data.weeks.length - 1 : this.currentWeekIndex;
            if (realIndex > 0) {
                this.currentWeekIndex = realIndex - 1;
                this.renderGoals();
            }
        });

        document.getElementById('nextWeekBtn').addEventListener('click', () => {
            const realIndex = this.currentWeekIndex === -1 ? this.data.weeks.length - 1 : this.currentWeekIndex;
            if (realIndex < this.data.weeks.length - 1) {
                this.currentWeekIndex = realIndex + 1;
                this.renderGoals();
            } else {
                this.currentWeekIndex = -1;
                this.renderGoals();
            }
        });

        document.getElementById('newWeekBtn').addEventListener('click', () => {
            this.createNewWeek();
            this.currentWeekIndex = -1;
            this.renderGoals();
        });

        document.getElementById('addGoalBtn').addEventListener('click', () => this.openModal('addGoalModal'));

        // Delegated: cell clicks, strike +/-, and day-header vacation toggles
        // Bound once here instead of re-binding inside renderGoals on every render
        document.getElementById('goalsGrid').addEventListener('click', (e) => {
            const cell = e.target.closest('.day-cell:not(.vacation-day)');
            if (cell) {
                this.toggleGoalCell(parseInt(cell.dataset.goal), parseInt(cell.dataset.day));
                return;
            }
            const incBtn = e.target.closest('.strike-inc');
            if (incBtn) {
                const week = this.getCurrentWeek();
                if (!week) return;
                const idx = incBtn.dataset.goal;
                const entry = week.entries[idx] ?? week.entries[parseInt(idx)];
                if (!entry) return;
                entry.manual = (entry.manual || 0) + 1;
                this.saveData();
                this.renderGoals();
                return;
            }
            const decBtn = e.target.closest('.strike-dec');
            if (decBtn) {
                const week = this.getCurrentWeek();
                if (!week) return;
                const idx = decBtn.dataset.goal;
                const entry = week.entries[idx] ?? week.entries[parseInt(idx)];
                if (!entry) return;
                // Manual adjustments can go negative to cancel inferred misses; the total never drops below 0
                if (this.scoreEntry(week, entry).misses > 0) entry.manual = (entry.manual || 0) - 1;
                this.saveData();
                this.renderGoals();
                return;
            }
            const th = e.target.closest('.day-header');
            if (th) {
                const dayIdx = parseInt(th.dataset.day);
                const w = this.getCurrentWeek();
                if (!w) return;
                if (!w.vacationDays) w.vacationDays = [];
                const isVac = w.vacationDays.includes(dayIdx);
                w.vacationDays = isVac
                    ? w.vacationDays.filter(d => d !== dayIdx)
                    : [...w.vacationDays, dayIdx].sort();
                w.vacation = w.vacationDays.length === 7;
                this.saveData();
                this.renderGoals();
            }
        });

        document.getElementById('vacationWeekBtn').addEventListener('click', () => {
            const week = this.getCurrentWeek();
            if (!week) return;
            // Toggle: full week vacation flips all 7 days
            if (!week.vacationDays) week.vacationDays = [];
            const allVacation = week.vacationDays.length === 7;
            week.vacationDays = allVacation ? [] : [0,1,2,3,4,5,6];
            // Keep legacy vacation flag in sync
            week.vacation = !allVacation;
            this.saveData();
            this.logActivity(week.vacation ? 'Marked full week as vacation' : 'Removed vacation from week');
            this.renderGoals();
        });
    }

    renderGoals() {
        this.updateAppBadge();
        const week = this.getCurrentWeek();
        if (!week) {
            document.getElementById('goalsGrid').innerHTML = '<div class="empty-state">No weeks yet. Click "+ New Week" to start.</div>';
            return;
        }

        // Week label + vacation indicator
        const vacDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);
        const isFullVacation = vacDays.length === 7;
        document.getElementById('currentWeekLabel').textContent = (isFullVacation ? '🏖️ ' : '') + this.formatWeekDate(week.startDate);
        const vacBtn = document.getElementById('vacationWeekBtn');
        vacBtn.textContent = isFullVacation ? '✓ Full Vacation' : '🏖️ Vacation';
        vacBtn.className = `btn btn-sm ${isFullVacation ? 'btn-primary' : 'btn-secondary'}`;

        // Build table
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekVacDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);
        let html = '<table><thead><tr><th>Goal</th>';
        days.forEach((d, i) => {
            const isVac = weekVacDays.includes(i);
            html += `<th class="day-header${isVac ? ' vac-header' : ''}" data-day="${i}" title="${isVac ? 'Click to remove vacation' : 'Click to mark as vacation'}">${isVac ? '🏖️' : d}</th>`;
        });
        html += '<th>Strikes</th></tr></thead><tbody>';

        // Group by category
        const grouped = {};
        Object.entries(week.entries).forEach(([idx, entry]) => {
            const cat = entry.goal.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ idx: parseInt(idx), ...entry });
        });

        let grandTotal = 0;
        for (const [cat, entries] of Object.entries(grouped)) {
            html += `<tr><td class="cat-header" colspan="${days.length + 2}">${cat}</td></tr>`;
            let catTotal = 0;
            entries.forEach(entry => {
                html += `<tr><td class="goal-name-cell">${this.escapeHtml(entry.goal.name)}</td>`;
                const goalDays = this.getGoalDays(entry.goal);
                entry.tracking.forEach((val, dayIdx) => {
                    let cls = 'day-cell';
                    let display = '';
                    if (weekVacDays.includes(dayIdx)) {
                        cls += ' vacation-day';
                        display = '🏖️';
                    } else if (val === 'X' || val === 'x') {
                        cls += ' completed';
                        display = '\u2713';
                    } else if (val === '1') {
                        cls += ' missed';
                        display = '\u2717';
                    } else if (val === '-') {
                        cls += ' skipped';
                        display = '\u2013';
                    } else if (val === '' && !goalDays.includes(dayIdx)) {
                        cls += ' off-day';
                    } else if (this.isInferredMiss(week, entry, dayIdx)) {
                        cls += ' inferred-miss';
                        display = '\u2717';
                    }
                    html += `<td class="${cls}" data-goal="${entry.idx}" data-day="${dayIdx}">${display}</td>`;
                });
                const totalStrikes = this.scoreEntry(week, entry).misses;
                catTotal += totalStrikes;
                grandTotal += totalStrikes;
                const decBtn = totalStrikes > 0 ? `<button class="strike-dec" data-goal="${entry.idx}">−</button>` : '';
                html += `<td class="strike-count strike-cell" data-goal="${entry.idx}">
                    ${decBtn}<span class="strike-num">${totalStrikes > 0 ? totalStrikes : ''}</span><button class="strike-inc" data-goal="${entry.idx}">+</button>
                </td></tr>`;
            });
            // Category subtotal row
            html += `<tr class="subtotal-row"><td colspan="${days.length + 1}" class="subtotal-label">${cat} subtotal</td><td class="strike-count subtotal-val">${catTotal > 0 ? catTotal : '—'}</td></tr>`;
        }

        // Grand total row
        html += `<tr class="grand-total-row"><td colspan="${days.length + 1}" class="grand-total-label">Total Strikes This Week</td><td class="strike-count grand-total-val">${grandTotal > 0 ? grandTotal : '0'}</td></tr>`;
        html += '</tbody></table>';
        document.getElementById('goalsGrid').innerHTML = html;

        this.renderGoalCharts();
        this.renderGoalsList();
    }

    toggleGoalCell(goalIdx, dayIdx) {
        const week = this.getCurrentWeek();
        if (!week) return;
        // Entries may be keyed as strings or integers depending on import source
        const entry = week.entries[goalIdx] ?? week.entries[String(goalIdx)];
        if (!entry) return;

        // Cycle: empty → ✓ done → ✗ strike → – skipped (doesn't apply) → empty
        const current = entry.tracking[dayIdx];
        if (current === '') {
            entry.tracking[dayIdx] = 'X';
        } else if (current === 'X' || current === 'x') {
            entry.tracking[dayIdx] = '1';
        } else if (current === '-') {
            entry.tracking[dayIdx] = '';
        } else {
            entry.tracking[dayIdx] = '-';
        }

        this.saveData();
        this.renderGoals();
    }

    renderGoalCharts() {
        // Strikes over time
        const labels = [];
        const strikesData = [];
        this.data.weeks.slice(-12).forEach(week => {
            const d = new Date(week.startDate);
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            strikesData.push(this.scoreWeek(week).misses);
        });

        const strikesCanvas = document.getElementById('goalStrikesChart');
        if (this.charts.goalStrikes) this.charts.goalStrikes.destroy();
        this.charts.goalStrikes = new Chart(strikesCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Strikes',
                    data: strikesData,
                    borderColor: this.themeColor('danger'),
                    backgroundColor: this.themeColor('danger-tint'),
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Category performance
        const week = this.getCurrentWeek();
        const catStats = week ? this.scoreByCategory(week) : {};

        const catLabels = Object.keys(catStats);
        const catPcts = catLabels.map(c => this.scorePct(catStats[c]));

        const catCanvas = document.getElementById('goalCategoryChart');
        if (this.charts.goalCategory) this.charts.goalCategory.destroy();
        this.charts.goalCategory = new Chart(catCanvas, {
            type: 'bar',
            data: {
                labels: catLabels,
                datasets: [{
                    label: 'Completion %',
                    data: catPcts,
                    backgroundColor: this.themeColor('primary'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }

    renderGoalsList() {
        const container = document.getElementById('goalsList');
        const grouped = {};
        this.data.goals.forEach((goal, i) => {
            if (!grouped[goal.category]) grouped[goal.category] = [];
            grouped[goal.category].push({ ...goal, index: i });
        });

        const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const cats = Object.keys(grouped);

        let html = '<p class="setting-desc">Tap the day letters to set which days each goal applies to. Greyed-out days don\'t count against you.</p>';
        cats.forEach((cat, catIdx) => {
            html += `<div class="goal-category-group">
                <h4><span>${this.escapeHtml(cat)}</span>
                    <span class="cat-days-actions">
                        <button class="cat-days-btn" data-cat-idx="${catIdx}" data-cat-days="weekdays">Mon–Fri</button>
                        <button class="cat-days-btn" data-cat-idx="${catIdx}" data-cat-days="all">Every day</button>
                    </span>
                </h4>`;
            grouped[cat].forEach(g => {
                const activeDays = this.getGoalDays(g);
                const chips = dayLetters.map((letter, d) =>
                    `<button class="day-chip${activeDays.includes(d) ? ' on' : ''}" data-goal-idx="${g.index}" data-day="${d}" title="${dayNames[d]}">${letter}</button>`
                ).join('');
                html += `<div class="goal-list-item">
                    <span class="goal-list-name">${this.escapeHtml(g.name)} ${g.target ? '(' + this.escapeHtml(g.target) + ')' : ''}</span>
                    <div class="goal-list-actions">
                        <div class="day-chips">${chips}</div>
                        <button class="goal-remove-btn" data-remove-goal="${g.index}">Remove</button>
                    </div>
                </div>`;
            });
            html += '</div>';
        });
        container.innerHTML = html;

        // Toggle a single day on a goal's schedule
        container.querySelectorAll('.day-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const goalIdx = parseInt(chip.dataset.goalIdx);
                const day = parseInt(chip.dataset.day);
                const days = new Set(this.getGoalDays(this.data.goals[goalIdx]));
                if (days.has(day)) {
                    if (days.size === 1) return; // a goal needs at least one day
                    days.delete(day);
                } else {
                    days.add(day);
                }
                this.setGoalDays(goalIdx, days);
                this.saveData();
                this.renderGoals();
            });
        });

        // Apply Mon–Fri or every day to a whole category
        container.querySelectorAll('.cat-days-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = cats[parseInt(btn.dataset.catIdx)];
                const days = btn.dataset.catDays === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
                grouped[cat].forEach(g => this.setGoalDays(g.index, days));
                this.saveData();
                this.logActivity(`Set ${cat} to ${btn.dataset.catDays === 'weekdays' ? 'Mon–Fri' : 'every day'}`);
                this.renderGoals();
            });
        });

        // Bind remove buttons
        container.querySelectorAll('[data-remove-goal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeGoal);
                if (confirm('Remove this goal?')) {
                    this.data.goals.splice(idx, 1);
                    this.saveData();
                    this.logActivity('Removed a goal');
                    this.renderGoals();
                }
            });
        });
    }

    importFromAccountabilityTracker() {
        try {
            const raw = localStorage.getItem('accountabilityData');
            if (!raw) {
                alert('No accountability tracker data found in LocalStorage (key: accountabilityData).');
                return;
            }
            const trackerData = JSON.parse(raw);
            let importedItems = [];

            // Import goals - handle various formats
            if (trackerData.goals && Array.isArray(trackerData.goals)) {
                this.data.goals = trackerData.goals.map(g => ({
                    category: g.category || 'Other',
                    name: g.name || g.title || g.goal || 'Unnamed Goal',
                    target: g.target || g.frequency || ''
                }));
                importedItems.push(`${this.data.goals.length} goals`);
            }

            // Import weeks - normalize entries structure
            if (trackerData.weeks && Array.isArray(trackerData.weeks)) {
                this.data.weeks = trackerData.weeks.map(w => {
                    const week = {
                        startDate: w.startDate || w.start || w.date || new Date().toISOString(),
                        entries: {}
                    };
                    // Handle entries as object or array
                    const entries = w.entries || w.data || {};
                    if (Array.isArray(entries)) {
                        entries.forEach((entry, idx) => {
                            week.entries[idx] = {
                                goal: entry.goal || { category: 'Other', name: 'Goal ' + idx },
                                tracking: Array.isArray(entry.tracking) ? entry.tracking : ['', '', '', '', '', '', '']
                            };
                        });
                    } else {
                        Object.entries(entries).forEach(([key, entry]) => {
                            week.entries[key] = {
                                goal: entry.goal || { category: 'Other', name: 'Goal ' + key },
                                tracking: Array.isArray(entry.tracking) ? entry.tracking : ['', '', '', '', '', '', '']
                            };
                        });
                    }
                    return week;
                });
                importedItems.push(`${this.data.weeks.length} weeks`);
            }

            if (trackerData.categories && Array.isArray(trackerData.categories)) {
                this.data.categories = trackerData.categories;
            }

            this.saveData();
            this.logActivity('Imported data from Accountability Tracker');
            this.renderGoals();
            alert(importedItems.length > 0
                ? `Imported: ${importedItems.join(', ')} from Accountability Tracker!`
                : 'No data found to import.');
        } catch (e) {
            alert('Error importing data: ' + e.message);
        }
    }

    // ========================================
    // Health Section
    // ========================================
    // Daily check-in: fill in any of weight, sleep, energy, then one Save. Energy taps only
    // select; nothing is written until Save. Today's saved values come back into the fields.
    bindHealthLog() {
        document.getElementById('energyButtons').addEventListener('click', (e) => {
            const btn = e.target.closest('.energy-btn');
            if (!btn) return;
            const on = btn.getAttribute('aria-pressed') !== 'true';
            document.querySelectorAll('.energy-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            if (on) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            }
        });
        document.getElementById('saveCheckinBtn').addEventListener('click', () => this.saveCheckin());
    }

    saveCheckin() {
        const status = document.getElementById('checkinStatus');
        const num = id => {
            const raw = document.getElementById(id).value.trim();
            return raw === '' ? null : parseFloat(raw);
        };
        const weight = num('weightInput');
        const sleep = num('sleepInput');
        const picked = document.querySelector('.energy-btn[aria-pressed="true"]');
        const energy = picked ? parseInt(picked.dataset.level) : null;
        if (weight !== null && !(weight > 50 && weight < 600)) {
            status.textContent = 'Weight looks off. Check the number and save again.';
            return;
        }
        if (sleep !== null && !(sleep >= 0 && sleep <= 24)) {
            status.textContent = 'Sleep should be between 0 and 24 hours.';
            return;
        }
        if (weight === null && sleep === null && energy === null) {
            status.textContent = 'Enter at least one: weight, sleep or energy.';
            return;
        }
        const today = this.getTodayStr();
        let entry = this.data.healthLog.find(e => e.date === today);
        if (!entry) {
            entry = { date: today };
            this.data.healthLog.push(entry);
            this.data.healthLog.sort((a, b) => (a.date < b.date ? -1 : 1));
        }
        if (weight !== null) entry.weight = weight;
        if (sleep !== null && sleep !== entry.sleep) {
            entry.sleep = sleep;
            delete entry.sleepSource; // typed over the watch's number: it's yours now
        }
        if (energy !== null) entry.energy = energy;
        this.saveData();
        this.logActivity('Saved daily check-in');
        this.renderHealth();
    }

    // Show today's saved check-in in the fields and the status line
    renderCheckin() {
        const status = document.getElementById('checkinStatus');
        if (!status) return;
        const entry = this.data.healthLog.find(e => e.date === this.getTodayStr()) || {};
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (document.activeElement !== el) el.value = v ?? '';
        };
        set('weightInput', entry.weight);
        set('sleepInput', entry.sleep);
        document.querySelectorAll('.energy-btn').forEach(b => {
            const on = Number(b.dataset.level) === entry.energy;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        const parts = [];
        if (entry.weight != null) parts.push(`${entry.weight} lb`);
        if (entry.sleep != null) parts.push(`${entry.sleep} h sleep${entry.sleepSource === 'watch' ? ' (Apple Watch)' : ''}`);
        if (entry.energy != null) parts.push(`energy ${entry.energy}/5`);
        status.textContent = parts.length ? `Saved for today: ${parts.join(' · ')}` : 'Nothing saved yet today.';
        document.getElementById('saveCheckinBtn').textContent = parts.length ? 'Update check-in' : 'Save check-in';
    }

    // ========================================
    // Apple Watch sleep: an iPhone Shortcut posts each night to Convex (/ingest/sleep, health.ts);
    // here it's copied into the Health log like weigh-ins, and an early enough bedtime ticks the
    // "In bed by …" goal for that night
    // ========================================
    get BEDTIME_GOAL() { return /in bed by/i; }

    async syncSleep(force = false) {
        if (!this.convex || this._sleepSyncing) return;
        if (!force && Date.now() - (this._sleepSyncedAt || 0) < 60e3) return;
        this._sleepSyncing = true;
        this._sleepSyncedAt = Date.now();
        try {
            const pending = await this.convex.query('health:pendingSleep');
            if (!pending || !pending.length) return;
            for (const night of pending) {
                let entry = this.data.healthLog.find(e => e.date === night.date);
                if (!entry) {
                    entry = { date: night.date };
                    this.data.healthLog.push(entry);
                }
                entry.sleep = night.hours;
                entry.sleepSource = 'watch';
                if (night.bedtime) entry.bedtime = night.bedtime;
                if (night.bedtime && night.nightOf) this.tickBedtime(night.nightOf, night.bedtime);
            }
            this.data.healthLog.sort((a, b) => (a.date < b.date ? -1 : 1));
            this.saveData();
            this.renderAll();
            // After the Health log is saved, so a night can't be lost in between
            this.convex.mutation('health:markSleepApplied', { ids: pending.map(n => n.id) })
                .catch(() => { /* applied again next time, harmlessly */ });
        } catch (e) {
            /* offline, locked or not deployed yet: try again on the next render */
        } finally {
            this._sleepSyncing = false;
        }
    }

    // Tick "In bed by 11:15PM" on the night's day when the bedtime ("HH:MM", 24h) beat the time in
    // its name. After midnight is always late; unscheduled, skipped and vacation days are left alone.
    tickBedtime(nightOf, bedtime) {
        const [bh, bm] = bedtime.split(':').map(Number);
        if (!(bh >= 12)) return false;
        const [y, m, d] = nightOf.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const week = this.getWeekForDate(date);
        const entry = week && Object.values(week.entries).find(e => this.BEDTIME_GOAL.test(e.goal.name));
        const target = entry && entry.goal.name.match(/in bed by\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (!target || !this.isExpected(week, entry, date.getDay())) return false;
        const th = (Number(target[1]) % 12) + (/am/i.test(target[3] || '') ? 0 : 12);
        if (bh * 60 + bm > th * 60 + Number(target[2] || 0)) return false;
        return this.autoTickGoal(this.BEDTIME_GOAL, nightOf);
    }

    renderHealth() {
        this.syncSleep();
        this.renderCheckin();
        this.renderHealthRings();
        this.renderHealthCharts();
        this.renderNutrition();
        this.renderTraining();
    }

    // ========================================
    // Nutrition (meals come from Claude through the Convex connector; this side only reads)
    // ========================================
    // A daily goal whose name matches this is checked off on days protein hits the target
    get PROTEIN_GOAL() { return /protein target/i; }

    renderNutrition() {
        const body = document.getElementById('nutritionBody');
        if (!body) return;
        if (!this.convex) {
            body.innerHTML = '<p class="nutrition-note">Connect Convex in Settings to see meals you log with Claude.</p>';
            return;
        }
        const n = this._nutrition;
        const stale = !n || Date.now() - n.loadedAt > 60e3 || n.today !== this.localDateKey(new Date());
        if (stale) this.loadNutrition();
        if (!n) {
            body.innerHTML = '<p class="nutrition-note">Loading meals&hellip;</p>';
            return;
        }
        if (n.error) {
            body.innerHTML = '<p class="nutrition-note">Couldn\'t load meals. They\'ll appear when the connection is back.</p>';
            return;
        }
        const T = n.targets;
        const byDate = new Map(n.days.map(d => [d.date, d]));
        const t = byDate.get(n.today) || { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
        const fmt = x => Math.round(x).toLocaleString('en-US');
        const bar = (label, val, target, unit, over) => {
            const pct = target ? Math.min(val / target, 1) * 100 : 0;
            const left = target - val;
            const note = left >= 0 ? `${fmt(left)}${unit} to go` : `${fmt(-left)}${unit} over`;
            return `<div class="nutrition-row">
                <div class="nutrition-row-top"><b>${label}</b><span><span class="nutrition-num">${fmt(val)}</span> / ${fmt(target)}${unit}</span></div>
                <div class="nutrition-bar"><i class="${over && left < 0 ? 'over' : ''}" style="width:${pct}%"></i></div>
                <div class="nutrition-row-note">${note}</div>
            </div>`;
        };
        // Last 14 days of protein, oldest first
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days.push(this.localDateKey(d));
        }
        const hits = days.filter(d => (byDate.get(d)?.protein || 0) >= T.protein).length;
        const cells = days.map(d => {
            const day = byDate.get(d);
            const cls = !day ? 'none' : day.protein >= T.protein ? 'hit' : 'short';
            const label = `${d}: ${day ? fmt(day.protein) + 'g protein' : 'nothing logged'}`;
            return `<span class="nutrition-day ${cls}" title="${label}" aria-label="${label}"></span>`;
        }).join('');
        body.innerHTML = `
            ${t.meals ? '' : '<p class="nutrition-note">Nothing logged today yet. Tell Claude what you ate, or send a photo.</p>'}
            ${bar('Calories', t.calories, T.calories, '', true)}
            ${bar('Protein', t.protein, T.protein, 'g', false)}
            <div class="nutrition-small">Carbs ${fmt(t.carbs)}g &middot; Fat ${fmt(t.fat)}g &middot; ${t.meals} ${t.meals === 1 ? 'meal' : 'meals'}</div>
            <div class="nutrition-streak">
                <div class="nutrition-days">${cells}</div>
                <div class="nutrition-row-note">Protein target hit ${hits} of the last 14 days</div>
            </div>`;
    }

    async loadNutrition() {
        if (!this.convex || this._nutritionLoading) return;
        this._nutritionLoading = true;
        const today = this.localDateKey(new Date());
        const from = new Date(); from.setDate(from.getDate() - 13);
        try {
            const res = await this.convex.query('nutrition:getRange', { from: this.localDateKey(from), to: today });
            this._nutrition = { ...res, today, loadedAt: Date.now() };
            const ticked = this.applyProteinCheckoffs();
            const weighInIds = await this.applyWeighIns();
            if (ticked || weighInIds.length) {
                this.saveData();
                this.renderAll(); // includes this card, now fresh
                // After the Health log is saved, so a weigh-in can't be lost in between
                if (weighInIds.length) {
                    this.convex.mutation('nutrition:markWeighInsApplied', { ids: weighInIds })
                        .catch(() => { /* applied again next load, harmlessly */ });
                }
            } else {
                this.renderNutrition();
            }
        } catch (e) {
            console.error('[LifeOS] nutrition load failed:', e);
            this._nutrition = { error: true, today, loadedAt: Date.now() };
            this.renderNutrition();
        } finally {
            this._nutritionLoading = false;
        }
    }

    // Tick the protein goal on each loaded day that reached the target. Leaves "doesn't apply"
    // days alone. Returns true if any cell changed.
    applyProteinCheckoffs() {
        const n = this._nutrition;
        if (!n || n.error) return false;
        let changed = false;
        for (const day of n.days) {
            if (day.protein >= n.targets.protein && this.autoTickGoal(this.PROTEIN_GOAL, day.date)) changed = true;
        }
        return changed;
    }

    // Tick from synced data (protein, workouts): the goal's cell on that local date, unless it's
    // already done or marked "doesn't apply". Unlike checkOffGoal, which follows a tap, it never
    // overrides a '-'. Returns true if the cell changed.
    autoTickGoal(pattern, dateKey) {
        const [y, m, d] = dateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const week = this.getWeekForDate(date);
        const entry = week && Object.values(week.entries).find(e => pattern.test(e.goal.name));
        const cell = entry && entry.tracking[date.getDay()];
        if (!entry || this.isDone(cell) || cell === '-') return false;
        entry.tracking[date.getDay()] = 'X';
        return true;
    }

    // Copy weigh-ins sent from Claude into the Health log; returns their ids to mark applied
    async applyWeighIns() {
        let pending = [];
        try { pending = await this.convex.query('nutrition:pendingWeighIns'); } catch { return []; }
        if (!pending.length) return [];
        for (const w of pending) {
            let entry = this.data.healthLog.find(e => e.date === w.date);
            if (!entry) {
                entry = { date: w.date };
                this.data.healthLog.push(entry);
            }
            entry.weight = w.lb;
        }
        this.data.healthLog.sort((a, b) => (a.date < b.date ? -1 : 1));
        return pending.map(w => w.id);
    }

    // ========================================
    // Training (workouts come from Claude through the Convex connector; this side only reads)
    // ========================================
    // Goals ticked on each day a matching session was logged. Core moves inside a lift don't
    // tick the core goal: only a session Claude logs as type "core" does.
    get WORKOUT_GOALS() {
        return [
            { pattern: /strength training/i, hit: s => s.type === 'strength' },
            { pattern: /cardio training/i, hit: s => s.type === 'cardio' || s.type === 'swim' },
            { pattern: /core work ?out/i, hit: s => s.type === 'core' },
        ];
    }

    renderTraining() {
        const body = document.getElementById('trainingBody');
        if (!body) return;
        if (!this.convex) {
            body.innerHTML = '<p class="training-note">Connect Convex in Settings to see workouts you log with Claude.</p>';
            return;
        }
        const t = this._training;
        const stale = !t || Date.now() - t.loadedAt > 60e3 || t.today !== this.localDateKey(new Date());
        if (stale) this.loadTraining();
        if (!t) {
            body.innerHTML = '<p class="training-note">Loading workouts&hellip;</p>';
            return;
        }
        if (t.error) {
            body.innerHTML = '<p class="training-note">Couldn\'t load workouts. They\'ll appear when the connection is back.</p>';
            return;
        }
        const fmt = x => Math.round(x).toLocaleString('en-US');
        const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return this.localDateKey(d); };
        const shortDate = (key, weekday) => {
            const [y, m, d] = key.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString('en-US', weekday ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' });
        };

        // This week runs Sunday to Saturday, like the Goals grid
        const week = t.sessions.filter(s => s.date >= daysAgo(new Date().getDay()));
        const minutes = week.reduce((n, s) => n + (s.minutes || 0), 0);
        const types = ['strength', 'cardio', 'swim', 'core', 'mobility', 'other']
            .map(type => [type, week.filter(s => s.type === type).length])
            .filter(([, n]) => n)
            .map(([type, n]) => `${n} ${type}`)
            .join(' &middot; ');
        const summary = week.length
            ? `<div class="training-summary"><span class="training-big">${week.length}</span> <span>${week.length === 1 ? 'session' : 'sessions'}${minutes ? ` &middot; ${fmt(minutes)} min` : ''}</span></div>
               <div class="training-meta">${types}</div>`
            : '<p class="training-note">No workouts logged this week yet. Tell Claude about one, or send a screenshot from your watch.</p>';

        // Muscle groups worked this week
        const groups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
        const hit = new Set(week.flatMap(s => s.muscles || []));
        const missing = groups.filter(g => !hit.has(g));
        const chips = groups.map(g => `<span class="training-muscle${hit.has(g) ? ' hit' : ''}">${g[0].toUpperCase() + g.slice(1)}</span>`).join('');

        // Key lifts: best estimated 1-rep max of the last 4 weeks against the 4 weeks before
        const recentFrom = daysAgo(27), priorFrom = daysAgo(55);
        const best = list => list.reduce((a, s) => (!a || s.e1rm > a.e1rm ? s : a), null);
        const lifts = [['bench', 'Bench press'], ['squat', 'Squat'], ['deadlift', 'Deadlift'], ['ohp', 'Overhead press']].map(([key, label]) => {
            const sets = t.sessions.filter(s => s.lifts && s.lifts[key]).map(s => ({ date: s.date, ...s.lifts[key] }));
            const recent = best(sets.filter(s => s.date >= recentFrom));
            const prior = best(sets.filter(s => s.date >= priorFrom && s.date < recentFrom));
            const last = sets[sets.length - 1];
            let value = '&ndash;', meta = 'Not logged in the last 12 weeks';
            if (recent) {
                const d = prior ? recent.e1rm - prior.e1rm : null;
                const change = d === null ? ''
                    : d > 0 ? ` &middot; <span class="training-up">+${fmt(d)} lb</span> vs the 4 weeks before`
                    : d < 0 ? ` &middot; <span class="training-down">&minus;${fmt(-d)} lb</span> vs the 4 weeks before`
                    : ' &middot; same as the 4 weeks before';
                value = `${fmt(recent.e1rm)} lb`;
                meta = `Best set ${fmt(recent.weight)} &times; ${recent.reps} on ${shortDate(recent.date)}${change}`;
            } else if (last) {
                meta = `<span class="training-stale">Not trained in 4 weeks</span> &middot; last ${fmt(last.weight)} &times; ${last.reps} on ${shortDate(last.date)}`;
            }
            return `<div class="training-lift" data-lift="${key}">
                <b>${label}</b> <span class="training-e1rm">${value}</span>
                <span class="training-meta">${meta}</span>
            </div>`;
        }).join('');

        // Last two weeks, newest first
        const rows = t.sessions.filter(s => s.date >= daysAgo(13)).slice(-5).reverse().map(s => {
            const bits = [this.escapeHtml(s.name)];
            if (s.minutes) bits.push(`${fmt(s.minutes)} min`);
            if (s.distance) bits.push(`${s.distance.toLocaleString('en-US')} ${this.escapeHtml(s.distanceUnit || '')}`.trim());
            return `<li><span class="training-day">${shortDate(s.date, true)}</span> <span class="training-what">${bits.join(' &middot; ')}</span></li>`;
        }).join('');

        body.innerHTML = `
            ${this.workoutTodayHtml(t)}
            ${summary}
            <div class="training-label">Muscle groups this week</div>
            <div class="training-muscles">${chips}</div>
            ${week.length && missing.length ? `<div class="training-meta training-gap">Not yet: ${missing.join(', ')}</div>` : ''}
            <div class="training-label">Key lifts &middot; estimated 1-rep max</div>
            <div class="training-lifts">${lifts}</div>
            ${rows ? `<div class="training-label">Last 2 weeks</div><ul class="training-recent">${rows}</ul>` : ''}`;
    }

    async loadTraining() {
        if (!this.convex || this._trainingLoading) return;
        this._trainingLoading = true;
        const today = this.localDateKey(new Date());
        const from = new Date(); from.setDate(from.getDate() - 83); // 12 weeks, for the lift trends
        const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 6);
        try {
            const [res, plans] = await Promise.all([
                this.convex.query('workouts:getRange', { from: this.localDateKey(from), to: today }),
                // Plans Claude made for workout mode; the card still works if this fails
                this.convex.query('plans:forRange', { from: today, to: this.localDateKey(weekAhead) }).catch(() => []),
            ]);
            this._training = { sessions: (res && res.sessions) || [], plans: plans || [], today, loadedAt: Date.now() };
            if (this.applyWorkoutCheckoffs()) {
                this.saveData();
                this.renderAll(); // includes this card, now fresh
            } else {
                this.renderTraining();
            }
        } catch (e) {
            console.error('[LifeOS] training load failed:', e);
            this._training = { error: true, today, loadedAt: Date.now() };
            this.renderTraining();
        } finally {
            this._trainingLoading = false;
        }
    }

    // Tick the workout goals on each day a matching session was logged. Returns true if any cell changed.
    applyWorkoutCheckoffs() {
        const t = this._training;
        if (!t || t.error) return false;
        let changed = false;
        for (const s of t.sessions) {
            for (const g of this.WORKOUT_GOALS) {
                if (g.hit(s) && this.autoTickGoal(g.pattern, s.date)) changed = true;
            }
        }
        return changed;
    }

    // ========================================
    // Workout mode (Strong/Hevy-style): run a session Claude planned, set by set. The session in
    // progress lives in localStorage (lifeOS_activeWorkout), so a locked phone or a reload loses
    // nothing; Finish saves the ticked sets through workouts:finishSession.
    // ========================================
    get WORKOUT_KEY() { return 'lifeOS_activeWorkout'; }

    loadActiveWorkout() {
        if (this._workout === undefined) {
            try { this._workout = JSON.parse(this.getLocal(this.WORKOUT_KEY)) || null; } catch { this._workout = null; }
        }
        return this._workout;
    }

    saveActiveWorkout() {
        if (this._workout) this.setLocal(this.WORKOUT_KEY, JSON.stringify(this._workout));
        else try { localStorage.removeItem(this.WORKOUT_KEY); } catch { /* storage unavailable */ }
    }

    fmtClock(sec) {
        sec = Math.max(0, Math.round(sec));
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = String(sec % 60).padStart(2, '0');
        return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    }

    dayLabel(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Top of the Training card: resume, today's plan (or the next one), or how to get one
    workoutTodayHtml(t) {
        const esc = s => this.escapeHtml(s);
        const active = this.loadActiveWorkout();
        if (active) {
            const mins = Math.round((Date.now() - active.startedAt) / 60000);
            return `<div class="wk-today">
                <div class="wk-today-text"><b>Workout in progress</b> <span>${esc(active.name)} &middot; ${mins} min</span></div>
                <button class="btn btn-primary" data-wk="resume">Resume</button>
            </div>`;
        }
        const plans = t.plans || [];
        const todays = plans.find(p => p.date === t.today);
        if (todays && todays.status === 'done') {
            return `<div class="wk-today done"><div class="wk-today-text"><b>Done today</b> <span>${esc(todays.name)}</span></div></div>`;
        }
        const next = todays || plans.find(p => p.status === 'planned' && p.date > t.today);
        if (next) {
            return `<div class="wk-today">
                <div class="wk-today-text">
                    <b>${next.date === t.today ? 'Today&rsquo;s workout' : `Next: ${this.dayLabel(next.date)}`}</b>
                    <span>${esc(next.name)} &middot; ${next.exercises.length} ${next.exercises.length === 1 ? 'exercise' : 'exercises'}</span>
                    ${next.note ? `<small>${esc(next.note)}</small>` : ''}
                </div>
                <button class="btn btn-primary" data-wk="start" data-plan="${this.escapeAttr(next.id)}">Start</button>
            </div>`;
        }
        return `<div class="wk-today empty">
            <div class="wk-today-text"><span>Ask Claude to plan your next session and it shows up here, ready to start.</span></div>
            <button class="btn btn-secondary btn-sm" data-wk="start">Empty workout</button>
        </div>`;
    }

    // Key lifts in an exercise someone adds by hand, so they still count for progress
    guessLift(name) {
        const n = name.trim().toLowerCase();
        if (/^(barbell )?bench( press)?$/.test(n)) return 'bench';
        if (/^(barbell )?(back )?squats?$/.test(n)) return 'squat';
        if (/deadlift/.test(n) && !/romanian|rdl|stiff/.test(n)) return 'deadlift';
        if (/^(standing )?(barbell )?(overhead|military|ohp)( press)?$/.test(n)) return 'ohp';
        return null;
    }

    newWorkoutExercise(e) {
        const sets = e.sets && e.sets.length ? e.sets : [{ reps: '', weight: '' }, { reps: '', weight: '' }, { reps: '', weight: '' }];
        return {
            name: e.name, lift: e.lift || null, muscles: e.muscles || [], note: e.note || '',
            restSec: e.restSec ?? (e.lift ? 150 : 90),
            prev: null, flagged: false, skipped: false,
            sets: sets.map(s => ({ weight: s.weight, reps: s.reps, target: s.reps === '' ? null : s.reps, repsMax: s.repsMax || null, warmup: !!s.warmup, done: false })),
        };
    }

    startWorkout(planId) {
        if (this.loadActiveWorkout()) return this.openWorkout();
        const plan = planId ? (this._training?.plans || []).find(p => p.id === planId) : null;
        this._workout = {
            id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            planId: plan ? plan.id : null,
            date: this.localDateKey(new Date()),
            name: plan ? plan.name : 'Workout',
            note: plan?.note || '',
            notes: '',
            startedAt: Date.now(),
            restEndsAt: null,
            exercises: (plan ? plan.exercises : []).map(e => this.newWorkoutExercise(e)),
        };
        this.saveActiveWorkout();
        this.openWorkout();
        this.loadPreviousSets();
    }

    // Fill the Previous column (and empty weight/reps) from the last time each exercise was done
    async loadPreviousSets() {
        const w = this._workout;
        const names = w ? w.exercises.filter(e => !e.prev).map(e => e.name) : [];
        if (!names.length || !this.convex) return;
        try {
            const prev = await this.convex.query('workouts:lastSets', { names });
            if (this._workout !== w || !prev) return;
            for (const e of w.exercises) {
                const p = prev[e.name.trim().toLowerCase()];
                if (!p || e.prev) continue;
                e.prev = p.sets.map(x => `${x.weight || 'BW'}×${x.reps}`);
                e.sets.filter(x => !x.warmup).forEach((x, i) => {
                    const last = p.sets[Math.min(i, p.sets.length - 1)];
                    if (x.weight === '' || x.weight == null) x.weight = last.weight;
                    if (x.reps === '' || x.reps == null) x.reps = last.reps;
                });
            }
            this.saveActiveWorkout();
            this.renderWorkout();
        } catch (e) { /* offline: Previous stays blank */ }
    }

    openWorkout() {
        if (!this.loadActiveWorkout()) return;
        this._workoutView = 'sets';
        document.getElementById('workoutScreen').hidden = false;
        document.body.classList.add('workout-open');
        this.renderWorkout();
        clearInterval(this._workoutTick);
        this._workoutTick = setInterval(() => this.tickWorkout(), 500);
        this.tickWorkout();
        // Keeps the screen on between sets. Never awaited: it can hang in Home Screen apps
        if (!this._workoutLock) navigator.wakeLock?.request('screen').then(l => { this._workoutLock = l; }).catch(() => {});
    }

    // Hide leaves the session running; the Training card offers Resume
    hideWorkout() {
        document.getElementById('workoutScreen').hidden = true;
        document.body.classList.remove('workout-open');
        clearInterval(this._workoutTick);
        this._workoutLock?.release?.().catch(() => {});
        this._workoutLock = null;
        this._discardArmed = false;
        this.renderTraining();
    }

    renderWorkout() {
        const body = document.getElementById('workoutBody');
        if (this._workoutView === 'saved') return this.renderWorkoutSaved(body);
        const w = this._workout;
        if (!w) return;
        document.getElementById('workoutTitle').textContent = w.name;
        document.getElementById('workoutFinishBtn').hidden = false;
        if (this._workoutView === 'finish') return this.renderWorkoutFinish(body);
        const esc = s => this.escapeHtml(s);
        const check = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
        const cards = w.exercises.map((e, i) => {
            const working = e.sets.filter(x => !x.warmup);
            const range = working[0]?.repsMax ? `${working[0].target}&ndash;${working[0].repsMax}` : (working[0]?.target ?? '');
            const meta = [`${working.length} ${working.length === 1 ? 'set' : 'sets'}${range !== '' ? ` &times; ${range}` : ''}`, `rest ${this.fmtClock(e.restSec)}`].join(' &middot; ');
            let n = 0;
            const rows = e.sets.map((x, j) => {
                const label = x.warmup ? 'W' : String(++n);
                const prev = x.warmup ? '' : (e.prev && e.prev[Math.min(n - 1, e.prev.length - 1)]) || '';
                const placeholder = x.repsMax ? `${x.target}–${x.repsMax}` : (x.target ?? '');
                const what = `${this.escapeAttr(e.name)} set ${label}`;
                return `<div class="wk-row${x.done ? ' done' : ''}${x.warmup ? ' warmup' : ''}" data-set="${j}">
                    <span class="wk-set-n">${label}</span>
                    <span class="wk-prev">${prev ? esc(prev) : '&ndash;'}</span>
                    <input class="wk-in" data-field="weight" type="number" inputmode="decimal" step="any" min="0" value="${x.weight ?? ''}" aria-label="${what} weight, lb">
                    <input class="wk-in" data-field="reps" type="number" inputmode="numeric" min="0" value="${x.reps ?? ''}" placeholder="${placeholder}" aria-label="${what} reps">
                    <button class="wk-check" data-wk="done" aria-pressed="${x.done}" aria-label="${what} done">${check}</button>
                </div>`;
            }).join('');
            return `<section class="wk-ex${e.skipped ? ' skipped' : ''}" data-ex="${i}">
                <div class="wk-ex-head"><h3>${esc(e.name)}</h3>${e.lift ? '<span class="wk-tag">Key lift</span>' : ''}</div>
                <div class="wk-ex-meta">${meta}</div>
                ${e.note ? `<p class="wk-ex-note">${esc(e.note)}</p>` : ''}
                ${e.skipped ? '<p class="wk-ex-note">Skipped</p>' : `<div class="wk-sets">
                    <div class="wk-row wk-head" aria-hidden="true"><span>Set</span><span>Previous</span><span>lb</span><span>Reps</span><span></span></div>
                    ${rows}
                </div>`}
                <div class="wk-ex-actions">${e.skipped
                    ? '<button class="wk-link" data-wk="unskip">Undo skip</button>'
                    : `<button class="wk-link" data-wk="add-set">+ Add set</button>
                       <button class="wk-link wk-flag${e.flagged ? ' on' : ''}" data-wk="flag" aria-pressed="${e.flagged}">Felt discomfort</button>
                       <button class="wk-link" data-wk="skip">Skip</button>`}
                </div>
            </section>`;
        }).join('');
        const muscles = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'].map(m => `<option value="${m}">${m[0].toUpperCase() + m.slice(1)}</option>`).join('');
        body.innerHTML = `
            ${w.note ? `<p class="wk-plan-note">${esc(w.note)}</p>` : ''}
            ${cards || '<p class="training-note">Add your first exercise below.</p>'}
            <div class="wk-add">
                <input id="wkAddName" type="text" placeholder="Add an exercise" aria-label="Exercise name" autocomplete="off">
                <select id="wkAddMuscle" aria-label="Muscle group"><option value="">Muscle</option>${muscles}</select>
                <button class="btn btn-secondary btn-sm" data-wk="add-ex">Add</button>
            </div>`;
    }

    workoutTotals(w) {
        const sets = w.exercises.filter(e => !e.skipped).flatMap(e => e.sets.filter(x => x.done && !x.warmup));
        return {
            minutes: Math.max(1, Math.round((Date.now() - w.startedAt) / 60000)),
            sets: sets.length,
            volume: sets.reduce((n, x) => n + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0),
        };
    }

    renderWorkoutFinish(body) {
        const w = this._workout;
        const esc = s => this.escapeHtml(s);
        const t = this.workoutTotals(w);
        const skipped = w.exercises.filter(e => e.skipped).map(e => e.name);
        document.getElementById('workoutFinishBtn').hidden = true;
        body.innerHTML = `<div class="wk-finish">
            <h2>Finish workout?</h2>
            <p class="wk-finish-stats">${t.minutes} min &middot; ${t.sets} ${t.sets === 1 ? 'set' : 'sets'} &middot; ${Math.round(t.volume).toLocaleString('en-US')} lb lifted</p>
            ${skipped.length ? `<p class="training-meta">Skipped: ${skipped.map(esc).join(', ')}</p>` : ''}
            <label for="wkNotes">Notes for your coach</label>
            <textarea id="wkNotes" class="autogrow" rows="2" placeholder="How did it feel? How was the shoulder?">${esc(w.notes || '')}</textarea>
            <button class="btn btn-primary" data-wk="save">Save workout</button>
            <button class="btn btn-secondary" data-wk="back">Back to workout</button>
            <button class="wk-link wk-discard" data-wk="discard">${this._discardArmed ? 'Tap again to discard' : 'Discard workout'}</button>
            <p class="wk-finish-msg" id="wkFinishMsg" aria-live="polite"></p>
        </div>`;
        this.autoGrow(document.getElementById('wkNotes'));
    }

    renderWorkoutSaved(body) {
        const r = this._workoutResult;
        const esc = s => this.escapeHtml(s);
        const names = { bench: 'Bench press', squat: 'Squat', deadlift: 'Deadlift', ohp: 'Overhead press' };
        document.getElementById('workoutFinishBtn').hidden = true;
        body.innerHTML = `<div class="wk-finish">
            <h2>Workout saved</h2>
            <p class="wk-finish-stats">${esc(r.name)} &middot; ${r.minutes} min &middot; ${r.sets} ${r.sets === 1 ? 'set' : 'sets'}</p>
            ${r.newBests.length ? `<div class="wk-bests"><b>New best${r.newBests.length > 1 ? 's' : ''}</b><ul>${r.newBests.map(b =>
                `<li>${names[b.lift] || esc(b.lift)}: ${b.e1rm} lb estimated 1-rep max (${esc(b.set)})</li>`).join('')}</ul></div>` : ''}
            <p class="training-meta">Claude sees this session and your notes when it plans the next one.</p>
            <button class="btn btn-primary" data-wk="close">Done</button>
        </div>`;
    }

    async saveWorkout() {
        const w = this._workout;
        const msg = document.getElementById('wkFinishMsg');
        const exercises = w.exercises.filter(e => !e.skipped).map(e => {
            const ex = { name: e.name, muscles: e.muscles, sets: e.sets.filter(x => x.done && !x.warmup).map(x => ({ reps: Number(x.reps), weight: Number(x.weight) || 0 })) };
            if (e.lift) ex.lift = e.lift;
            if (e.flagged) ex.note = 'Felt discomfort';
            return ex;
        }).filter(e => e.sets.length);
        if (!exercises.length) {
            msg.textContent = 'Tick off at least one set, or discard the workout.';
            return;
        }
        const skipped = w.exercises.filter(e => e.skipped).map(e => e.name);
        const notes = [(w.notes || '').trim(), skipped.length ? `Skipped: ${skipped.join(', ')}` : ''].filter(Boolean).join('\n');
        const totals = this.workoutTotals(w);
        const payload = { externalId: w.id, date: w.date, name: w.name, minutes: totals.minutes, exercises };
        if (w.planId) payload.planId = w.planId;
        if (notes) payload.notes = notes;
        const btn = document.querySelector('[data-wk="save"]');
        btn.disabled = true;
        msg.textContent = 'Saving…';
        try {
            const res = await this.convex.mutation('workouts:finishSession', payload);
            this._workoutResult = { name: w.name, minutes: totals.minutes, sets: totals.sets, newBests: (res && res.newBests) || [] };
            this._workout = null;
            this.saveActiveWorkout();
            this._workoutView = 'saved';
            this.renderWorkout();
            this.tickWorkout();
            // Refetch: the card shows the session and the workout goals tick
            this._training = null;
            this.loadTraining();
        } catch (e) {
            console.error('[LifeOS] workout save failed:', e);
            btn.disabled = false;
            msg.textContent = 'Couldn’t save. The workout is kept on this phone; try again when you’re online.';
        }
    }

    startRest(sec) {
        const w = this._workout;
        if (!w || !sec) return;
        w.restEndsAt = Date.now() + sec * 1000;
        this._restChimed = false;
        this.saveActiveWorkout();
        this.tickWorkout();
    }

    // Every 500ms while the screen is open: elapsed clock and the rest countdown (both from
    // timestamps, so they're right again the moment the phone wakes)
    tickWorkout() {
        const w = this._workout;
        const bar = document.getElementById('workoutRest');
        if (!w) { bar.hidden = true; return; }
        document.getElementById('workoutClock').textContent = this.fmtClock((Date.now() - w.startedAt) / 1000);
        if (!w.restEndsAt || this._workoutView !== 'sets') { bar.hidden = true; return; }
        const left = (w.restEndsAt - Date.now()) / 1000;
        bar.hidden = false;
        bar.classList.toggle('over', left <= 0);
        document.getElementById('workoutRestLabel').textContent = left > 0 ? 'Rest' : 'Rest over';
        document.getElementById('workoutRestTime').textContent = this.fmtClock(Math.ceil(Math.max(0, left)));
        if (left <= 0 && !this._restChimed) {
            this._restChimed = true;
            this.medChime(true);
            navigator.vibrate?.(200);
        }
        if (left < -20) { w.restEndsAt = null; this.saveActiveWorkout(); bar.hidden = true; }
    }

    bindWorkout() {
        document.getElementById('trainingBody')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-wk]');
            if (!btn) return;
            if (btn.dataset.wk === 'resume') this.openWorkout();
            if (btn.dataset.wk === 'start') this.startWorkout(btn.dataset.plan);
        });
        document.getElementById('workoutMinimizeBtn').addEventListener('click', () => this.hideWorkout());
        document.getElementById('workoutFinishBtn').addEventListener('click', () => {
            this._workoutView = 'finish';
            this._discardArmed = false;
            this.renderWorkout();
            this.tickWorkout();
        });
        const screen = document.getElementById('workoutScreen');
        screen.addEventListener('input', e => {
            const w = this._workout;
            if (!w) return;
            if (e.target.id === 'wkNotes') { w.notes = e.target.value; this.saveActiveWorkout(); return; }
            if (!e.target.matches('.wk-in')) return;
            const ex = w.exercises[e.target.closest('[data-ex]').dataset.ex];
            const set = ex.sets[e.target.closest('[data-set]').dataset.set];
            set[e.target.dataset.field] = e.target.value === '' ? '' : Number(e.target.value);
            this.saveActiveWorkout();
        });
        screen.addEventListener('click', e => {
            const btn = e.target.closest('[data-wk]');
            if (!btn) return;
            const w = this._workout;
            const action = btn.dataset.wk;
            if (action === 'close') { this._workoutView = 'sets'; this.hideWorkout(); return; }
            if (!w) return;
            const exEl = btn.closest('[data-ex]');
            const ex = exEl && w.exercises[exEl.dataset.ex];
            if (action === 'done') {
                // Unlock audio from the tap, so the end-of-rest chime can play
                try { (this._medAudio || (this._medAudio = new (window.AudioContext || window.webkitAudioContext)())).resume(); } catch { /* no audio */ }
                const set = ex.sets[btn.closest('[data-set]').dataset.set];
                if (!set.done) {
                    if (set.reps === '' || set.reps == null) set.reps = set.target ?? '';
                    if (set.reps === '' || !(Number(set.reps) > 0)) {
                        btn.closest('[data-set]').querySelector('[data-field="reps"]').focus();
                        return;
                    }
                    if (set.weight === '' || set.weight == null) set.weight = 0;
                    set.done = true;
                    this.startRest(set.warmup ? Math.min(60, ex.restSec) : ex.restSec);
                } else {
                    set.done = false;
                }
            } else if (action === 'add-set') {
                const last = ex.sets[ex.sets.length - 1] || { weight: '', reps: '', target: null, repsMax: null };
                ex.sets.push({ weight: last.weight, reps: last.reps, target: last.target, repsMax: last.repsMax, warmup: false, done: false });
            } else if (action === 'flag') {
                ex.flagged = !ex.flagged;
            } else if (action === 'skip' || action === 'unskip') {
                ex.skipped = action === 'skip';
            } else if (action === 'add-ex') {
                const name = document.getElementById('wkAddName').value.trim();
                if (!name) { document.getElementById('wkAddName').focus(); return; }
                const muscle = document.getElementById('wkAddMuscle').value;
                w.exercises.push(this.newWorkoutExercise({ name, lift: this.guessLift(name), muscles: muscle ? [muscle] : [] }));
                this.saveActiveWorkout();
                this.renderWorkout();
                this.loadPreviousSets();
                return;
            } else if (action === 'rest-minus' || action === 'rest-plus') {
                if (!w.restEndsAt) return;
                w.restEndsAt = Math.max(Date.now(), w.restEndsAt) + (action === 'rest-plus' ? 15e3 : -15e3);
                this._restChimed = w.restEndsAt <= Date.now();
                this.saveActiveWorkout();
                this.tickWorkout();
                return;
            } else if (action === 'rest-skip') {
                w.restEndsAt = null;
                this.saveActiveWorkout();
                this.tickWorkout();
                return;
            } else if (action === 'back') {
                this._workoutView = 'sets';
                this._discardArmed = false;
            } else if (action === 'save') {
                this.saveWorkout();
                return;
            } else if (action === 'discard') {
                if (!this._discardArmed) { this._discardArmed = true; this.renderWorkout(); return; }
                this._workout = null;
                this.saveActiveWorkout();
                this._workoutView = 'sets';
                this.hideWorkout();
                return;
            }
            this.saveActiveWorkout();
            this.renderWorkout();
            this.tickWorkout();
        });
    }

    renderHealthRings() {
        const week = this.getCurrentWeek();
        if (!week) return;

        const scored = name => Object.values(week.entries)
            .filter(e => e.goal.name.includes(name))
            .map(e => this.scoreEntry(week, e));

        // Workouts (Strength + Cardio): progress toward the weekly targets — only ✓ count
        let workouts = 0, workoutTarget = 0;
        [...scored('Strength'), ...scored('Cardio')].forEach(s => {
            workouts += Math.min(s.checks, s.target);
            workoutTarget += s.target;
        });
        document.getElementById('workoutCount').textContent = `${workouts}/${workoutTarget}`;
        this.drawRing('workoutRing', workouts / Math.max(workoutTarget, 1));

        // Sleep (bedtime) and mindfulness (Meditate): nights done of nights expected so far
        const ring = (name, countId, ringId) => {
            const s = scored(name)[0] || { done: 0, expected: 0 };
            document.getElementById(countId).textContent = `${s.done}/${s.expected}`;
            this.drawRing(ringId, s.done / Math.max(s.expected, 1));
        };
        ring('bed by', 'sleepScore', 'sleepRing');
        ring('Meditate', 'mindfulCount', 'mindfulRing');

        // Substances (Zyns + alcohol) — limits: at/under the max = 100%
        const subst = [...scored('Zyn'), ...scored('drink')].reduce(
            (a, s) => ({ done: a.done + s.done, expected: a.expected + s.expected }), { done: 0, expected: 0 });
        const substPct = this.scorePct(subst);
        document.getElementById('substanceScore').textContent = substPct + '%';
        this.drawRing('substanceRing', substPct / 100);
    }

    drawRing(canvasId, progress, color = this.themeColor('primary')) {
        const canvas = document.getElementById(canvasId);
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        this.charts[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [Math.min(progress, 1) * 100, Math.max((1 - progress), 0) * 100],
                    backgroundColor: [color, this.themeColor('border-light')],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '75%',
                responsive: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }

    renderHealthCharts() {
        const logs = this.data.healthLog.slice(-30);

        // Weight trend
        const weightLogs = logs.filter(l => l.weight);
        const weightCanvas = document.getElementById('weightChart');
        if (this.charts.weight) this.charts.weight.destroy();
        if (weightLogs.length > 0) {
            this.charts.weight = new Chart(weightCanvas, {
                type: 'line',
                data: {
                    labels: weightLogs.map(l => l.date),
                    datasets: [{
                        label: 'Weight (lbs)',
                        data: weightLogs.map(l => l.weight),
                        borderColor: this.themeColor('primary'),
                        backgroundColor: this.themeColor('primary-tint'),
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Sleep trend
        const sleepLogs = logs.filter(l => l.sleep);
        const sleepCanvas = document.getElementById('sleepChart');
        if (this.charts.sleep) this.charts.sleep.destroy();
        if (sleepLogs.length > 0) {
            this.charts.sleep = new Chart(sleepCanvas, {
                type: 'bar',
                data: {
                    labels: sleepLogs.map(l => l.date),
                    datasets: [{
                        label: 'Hours',
                        data: sleepLogs.map(l => l.sleep),
                        backgroundColor: sleepLogs.map(l => this.themeColor(l.sleep >= 7 ? 'primary' : l.sleep >= 6 ? 'warning' : 'danger')),
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 12 } }
                }
            });
        }
    }

    // ========================================
    // Habits Section (Daily Protocols + Ad-Hoc Tasks)
    // ========================================
    bindHabits() {
        document.getElementById('addHabitBtn').addEventListener('click', () => this.openModal('addGoalModal'));

        // Delegated: habit checkbox clicks — bound once, survives re-renders
        document.getElementById('habitsChecklist').addEventListener('click', (e) => {
            // Remember which folded sections (Done, Missed, Limits…) are open across re-renders
            const summary = e.target.closest('details[data-fold] > summary');
            if (summary) {
                const details = summary.parentElement;
                this._todayFolds = { ...this._todayFolds, [details.dataset.fold]: !details.open };
                return;
            }
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'meditate') {
                this.navigateTo('meditate');
                return;
            }
            const week = this.getTodayWeek();
            if (!week) return;
            const entryIdx = btn.dataset.entryIdx;
            const dayIdx = parseInt(btn.dataset.day);
            const entry = week.entries[entryIdx] ?? week.entries[parseInt(entryIdx)];
            if (!entry) return;
            // done → ✓, miss → ✗ (strike), skip → doesn't apply, undo → blank, toggle → ✓/blank
            const next = { done: 'X', miss: '1', skip: '-', undo: '', toggle: this.isDone(entry.tracking[dayIdx]) ? '' : 'X' }[btn.dataset.action];
            if (next === undefined) return;
            entry.tracking[dayIdx] = next;
            this.saveData();
            // Let a row fade out of the list before it moves to Done / Missed
            const row = btn.closest('.pending-item');
            if (row) {
                row.classList.add('leaving');
                setTimeout(() => this.renderHabits(), 180);
            } else {
                this.renderHabits();
            }
        });

        document.getElementById('vacationDayBtn').addEventListener('click', () => {
            const week = this.getTodayWeek();
            if (!week) return;
            if (!week.vacationDays) week.vacationDays = [];
            const todayIdx = new Date().getDay();
            const isVacation = week.vacationDays.includes(todayIdx);
            if (isVacation) {
                week.vacationDays = week.vacationDays.filter(d => d !== todayIdx);
            } else {
                week.vacationDays.push(todayIdx);
            }
            // Keep legacy week.vacation in sync (true only if all 7 days are vacation)
            week.vacation = week.vacationDays.length === 7;
            this.saveData();
            this.logActivity(isVacation ? 'Removed travel day' : 'Marked today as travel day');
            this.renderHabits();
        });

        // Ad-hoc tasks
        document.getElementById('addAdhocTaskBtn').addEventListener('click', () => this.addAdhocTask());
        document.getElementById('adhocTaskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addAdhocTask();
        });
    }

    addAdhocTask() {
        const input = document.getElementById('adhocTaskInput');
        const text = input.value.trim();
        if (!text) return;

        if (!this.data.adhocTasks) this.data.adhocTasks = [];

        const weekStart = this.getWeekStartDate();
        this.data.adhocTasks.push({
            id: 'task_' + Date.now(),
            text: text,
            completed: false,
            weekStart: weekStart.toISOString(),
            created: new Date().toISOString()
        });

        input.value = '';
        this.saveData();
        this.logActivity(`Added task: ${text}`);
        this.renderAdhocTasks();
    }

    renderAdhocTasks() {
        const container = document.getElementById('adhocTasksList');
        if (!this.data.adhocTasks) this.data.adhocTasks = [];

        // Show tasks for current week
        const weekStart = this.getWeekStartDate();
        const weekTasks = this.data.adhocTasks.filter(t => {
            const taskWeek = new Date(t.weekStart);
            return taskWeek.toDateString() === weekStart.toDateString();
        });

        if (weekTasks.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:12px;font-size:0.85rem;">No ad-hoc tasks this week. Add tasks above.</div>';
            return;
        }

        container.innerHTML = weekTasks.map(t => `
            <div class="adhoc-task-item ${t.completed ? 'completed' : ''}">
                <div class="habit-checkbox ${t.completed ? 'checked' : ''}" data-adhoc="${t.id}">${t.completed ? '\u2713' : ''}</div>
                <span class="adhoc-task-text ${t.completed ? 'completed' : ''}">${this.escapeHtml(t.text)}</span>
                <button class="adhoc-delete" data-delete-adhoc="${t.id}">&times;</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-adhoc]').forEach(cb => {
            cb.addEventListener('click', () => {
                const task = this.data.adhocTasks.find(t => t.id === cb.dataset.adhoc);
                if (task) {
                    task.completed = !task.completed;
                    this.saveData();
                    this.renderAdhocTasks();
                }
            });
        });

        container.querySelectorAll('[data-delete-adhoc]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.data.adhocTasks = this.data.adhocTasks.filter(t => t.id !== btn.dataset.deleteAdhoc);
                this.saveData();
                this.renderAdhocTasks();
            });
        });
    }

    // Classify a goal's target into a frequency bucket
    classifyFrequency(target) {
        if (!target) return { group: 'daily', label: 'Daily', perWeek: 7 };
        const t = target.toLowerCase().trim();
        if (t === 'daily') return { group: 'daily', label: 'Every day', perWeek: 7 };
        if (t === 'weekdays' || t === 'weeknights') return { group: 'daily', label: 'Weekdays', perWeek: 5 };
        if (t === 'weekly') return { group: 'weekly', label: '1x/week', perWeek: 1 };
        if (t === 'monthly') return { group: 'monthly', label: 'Monthly', perWeek: 0.25 };
        // Parse "x1", "x2", "x1 max", "x2 max" etc.
        const xMatch = t.match(/x(\d+)/);
        if (xMatch) {
            const n = parseInt(xMatch[1]);
            const isMax = t.includes('max');
            if (isMax) return { group: 'limit', label: `${n}x max/week`, perWeek: n, isLimit: true };
            if (n <= 1) return { group: 'weekly', label: '1x/week', perWeek: 1 };
            return { group: 'fewPerWeek', label: `${n}x/week`, perWeek: n };
        }
        return { group: 'daily', label: target, perWeek: 7 };
    }

    renderHabits() {
        this.updateAppBadge();
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        const checklist = document.getElementById('habitsChecklist');
        const week = this.getTodayWeek();

        if (!week) {
            checklist.innerHTML = '<div class="empty-state">No active week. Go to Goals and click "+ New Week" first.</div>';
            this.renderAdhocTasks();
            return;
        }

        const todayDayIdx = new Date().getDay();

        // Travel day state
        const vacationDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);
        const isTravelDay = vacationDays.includes(todayDayIdx);
        const vacBtn = document.getElementById('vacationDayBtn');
        if (vacBtn) {
            vacBtn.textContent = isTravelDay ? '✓ Travel Day' : '🏖️ Travel Day';
            vacBtn.className = `vacation-day-btn${isTravelDay ? ' active' : ''}`;
        }

        if (isTravelDay) {
            checklist.innerHTML = `<div class="travel-day-notice">🏖️ <strong>Travel day!</strong> Streaks are preserved — enjoy your time off.</div>`;
            this.renderAdhocTasks();
            this.renderStreaks();
            this.renderHeatmap();
            return;
        }

        // Precompute streaks for badge display
        const streakMap = {};
        Object.values(week.entries).forEach(entry => {
            streakMap[entry.goal.name] = this.calculateGoalStreak(entry.goal.name);
        });

        // Build entries with frequency info
        const allEntries = [];
        const now = new Date();
        Object.entries(week.entries).forEach(([idx, entry]) => {
            // Group by the scoring rule: Budgeting is a limit, a custom day schedule makes a goal daily
            let freq = this.classifyFrequency(entry.goal.target);
            const kind = this.scoringKind(entry.goal);
            if (kind === 'limit' && !freq.isLimit) freq = { ...freq, group: 'limit', label: `${freq.perWeek}x max/week`, isLimit: true };
            else if (kind === 'daily' && freq.group !== 'daily') freq = { ...freq, group: 'daily' };
            const weekDone = entry.tracking.filter(v => v === 'X' || v === 'x').length;
            const weekStrikes = entry.tracking.filter(v => v === '1').length;
            const todayVal = entry.tracking[todayDayIdx];
            const todayDone = todayVal === 'X' || todayVal === 'x';
            const todayStrike = todayVal === '1';
            const todaySkipped = todayVal === '-';
            // Not scheduled today and untouched → off today (checking it anyway still counts)
            const offSchedule = !this.getGoalDays(entry.goal).includes(todayDayIdx) && todayVal === '';
            allEntries.push({
                idx: parseInt(idx),
                ...entry,
                freq,
                weekDone,
                weekStrikes,
                monthDone: kind === 'monthly' && this.isMonthlyDone(entry.goal.name, now.getFullYear(), now.getMonth()),
                todayDone,
                todayStrike,
                todaySkipped,
                offToday: todaySkipped || offSchedule
            });
        });

        // Shrinking list: what's left today stays on top; done / missed / not-today items
        // fold away at the bottom. Limits are logged uses, so they stay in their own group.
        const groups = [
            { key: 'daily', title: 'Daily Essentials' },
            { key: 'fewPerWeek', title: 'A Few Times This Week' },
            { key: 'weekly', title: 'Weekly Goals' },
            { key: 'limit', title: 'Limits & Boundaries' },
            { key: 'monthly', title: 'Monthly Goals' }
        ];
        const folds = this._todayFolds || {};
        const isLimit = e => e.freq.group === 'limit';
        const doneToday = allEntries.filter(e => e.todayDone && !isLimit(e));
        const missedToday = allEntries.filter(e => e.todayStrike && !isLimit(e));
        const pending = allEntries.filter(e => !e.offToday && (isLimit(e) || (!e.todayDone && !e.todayStrike)));
        const attrs = e => `data-entry-idx="${e.idx}" data-day="${todayDayIdx}"`;
        const name = e => this.escapeHtml(e.goal.name);

        const streakBadge = e => {
            const streak = streakMap[e.goal.name] || 0;
            const tier = streak >= 30 ? ['crown', '👑'] : streak >= 14 ? ['diamond', '💎'] : streak >= 7 ? ['star', '⭐'] : streak >= 3 ? ['fire', '🔥'] : null;
            return tier ? `<span class="streak-badge ${tier[0]}" title="${streak}-day streak">${tier[1]} ${streak}</span>` : '';
        };
        // Weekly / monthly / limit progress chip
        const progress = e => {
            const target = e.freq.perWeek;
            if (isLimit(e)) {
                const used = e.weekDone + e.weekStrikes;
                return `<span class="freq-progress ${used > target ? 'over-limit' : 'under-limit'}">${used}/${target} used</span>`;
            }
            if (e.freq.group === 'monthly') {
                return `<span class="freq-progress ${e.monthDone ? 'on-track' : ''}">${e.monthDone ? 'Done this month' : 'Not yet'}</span>`;
            }
            if (e.freq.group === 'daily') return '';
            const met = e.weekDone >= target;
            const pct = Math.min(100, Math.round((e.weekDone / target) * 100));
            return `<span class="freq-progress ${met ? 'on-track' : ''}">${e.weekDone}/${target}</span>
                <div class="freq-progress-bar"><div class="freq-progress-fill ${met ? 'met' : ''}" style="width:${pct}%"></div></div>`;
        };
        const playBtn = e => /meditat/i.test(e.goal.name)
            ? `<button class="habit-play-btn" data-action="meditate" aria-label="Start a guided session">${PLAY_ICON}</button>` : '';

        const pendingRow = e => {
            if (isLimit(e)) {
                // Tap logs a use today; tap again to remove it
                return `<div class="habit-check-item ${e.todayDone ? 'item-used' : ''}">
                    <button class="habit-checkbox ${e.todayDone ? 'checked' : ''}" data-action="toggle" ${attrs(e)} aria-label="Used one today">${e.todayDone ? '✓' : ''}</button>
                    <div class="habit-item-content"><span class="habit-name">${name(e)}</span>${progress(e)}</div>
                </div>`;
            }
            const canMiss = e.freq.group === 'daily';
            return `<div class="habit-check-item pending-item">
                <button class="habit-checkbox" data-action="done" ${attrs(e)} aria-label="Done"></button>
                <div class="habit-item-content">
                    <div class="habit-name-row"><span class="habit-name">${name(e)}</span>${streakBadge(e)}</div>
                    ${progress(e)}
                </div>
                ${playBtn(e)}
                ${canMiss ? `<button class="habit-miss-btn" data-action="miss" ${attrs(e)} aria-label="Missed today">✗</button>` : ''}
            </div>`;
        };

        let html = '';
        groups.forEach(group => {
            const all = allEntries.filter(e => e.freq.group === group.key && !e.offToday);
            const entries = pending.filter(e => e.freq.group === group.key);
            if (all.length === 0) return;
            if (entries.length === 0 && group.key !== 'daily') return;

            let count, countCls = '';
            if (group.key === 'daily') {
                count = entries.length ? `${entries.length} left` : 'All done ✓';
                if (!entries.length) countCls = 'all-done';
            } else if (group.key === 'limit') {
                const over = all.filter(e => e.weekDone + e.weekStrikes > e.freq.perWeek).length;
                count = over ? `${over} over` : 'All within';
                if (over) countCls = 'over';
            } else if (group.key === 'monthly') {
                count = `${all.filter(e => e.monthDone).length}/${all.length} done`;
            } else {
                count = `${all.filter(e => e.weekDone >= e.freq.perWeek).length}/${all.length} met`;
            }
            const header = `<span class="freq-label">${group.title}</span><span class="freq-group-count ${countCls}">${count}</span>`;

            // Sub-group by category: protocols first, then alphabetical
            const byCat = {};
            entries.forEach(e => (byCat[e.goal.category] ||= []).push(e));
            const protocolOrder = ['Morning Protocol', 'Midday Protocol', 'Evening Protocol'];
            const catKeys = [...protocolOrder.filter(c => byCat[c]), ...Object.keys(byCat).filter(c => !protocolOrder.includes(c)).sort()];
            let rows = '';
            catKeys.forEach(cat => {
                if (byCat[cat].length > 1 || catKeys.length > 1) rows += `<div class="freq-cat-label">${this.escapeHtml(cat)}</div>`;
                rows += byCat[cat].map(pendingRow).join('');
            });
            if (!entries.length) rows = '<p class="today-all-done">Nothing left for today. Nice work.</p>';

            if (group.key === 'limit') {
                // Limits only need a tap when you use one, so they start folded
                html += `<details class="freq-group limits-group" data-fold="limits"${folds.limits ? ' open' : ''}>
                    <summary><div class="freq-group-header">${header}</div></summary>${rows}</details>`;
            } else {
                html += `<div class="freq-group"><div class="freq-group-header">${header}</div>${rows}</div>`;
            }
        });

        const fold = (key, title, count, countCls, body, hint = '') => `
            <details class="off-today today-fold" data-fold="${key}"${folds[key] ? ' open' : ''}>
                <summary>${title} <span class="off-today-count ${countCls}">${count}</span></summary>
                ${body}${hint ? `<p class="off-today-hint">${hint}</p>` : ''}
            </details>`;

        if (doneToday.length) {
            html += fold('done', 'Done', doneToday.length, 'done-count', doneToday.map(e => `
                <div class="habit-check-item item-done">
                    <button class="habit-checkbox checked" data-action="undo" ${attrs(e)} aria-label="Undo">✓</button>
                    <div class="habit-item-content"><span class="habit-name completed">${name(e)}</span>${e.freq.group === 'daily' ? '' : progress(e)}</div>
                </div>`).join(''), 'Tap a check to undo it.');
        }
        if (missedToday.length) {
            html += fold('missed', 'Missed', missedToday.length, 'missed-count', missedToday.map(e => `
                <div class="habit-check-item item-missed">
                    <span class="miss-mark" aria-hidden="true">✗</span>
                    <div class="habit-item-content missed-content">
                        <span class="habit-name">${name(e)}</span>
                        <div class="missed-actions">
                            <button class="habit-unskip-btn" data-action="undo" ${attrs(e)}>Undo</button>
                            <button class="habit-skip-btn" data-action="skip" ${attrs(e)}>Doesn't apply</button>
                        </div>
                    </div>
                </div>`).join(''), 'Missed items count as strikes. "Doesn\'t apply" takes it off today instead.');
        }

        // Items skipped today or not scheduled today
        const offEntries = allEntries.filter(e => e.offToday);
        if (offEntries.length) {
            const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            html += fold('off', "Doesn't apply today", offEntries.length, '', offEntries.map(e => `
                <div class="habit-check-item off-item">
                    <button class="habit-checkbox" data-action="done" ${attrs(e)} title="Did it anyway" aria-label="Did it anyway"></button>
                    <div class="habit-item-content">
                        <span class="habit-name">${name(e)}</span>
                        <span class="off-reason">${e.todaySkipped ? 'Skipped' : `Not on ${dayName}s`}</span>
                    </div>
                    ${e.todaySkipped ? `<button class="habit-unskip-btn" data-action="undo" ${attrs(e)}>Undo</button>` : ''}
                </div>`).join(''), 'Set recurring days for a goal under Goals &rarr; Manage Goals.');
        }

        checklist.innerHTML = html;

        this.renderAdhocTasks();
        this.renderStreaks();
        this.renderHeatmap();
    }

    calculateGoalStreak(goalName) {
        // Count consecutive days completed going backward from today, across all weeks
        const sortedWeeks = [...this.data.weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        if (sortedWeeks.length === 0) return 0;

        let streak = 0;
        let weekIdx = sortedWeeks.length - 1;
        const todayIdx = new Date().getDay();
        let dayIdx = todayIdx;

        while (weekIdx >= 0) {
            const week = sortedWeeks[weekIdx];
            const vacDays = week.vacationDays || (week.vacation ? [0,1,2,3,4,5,6] : []);

            const entry = Object.values(week.entries).find(e => e.goal.name === goalName);
            if (!entry) break;

            for (let d = dayIdx; d >= 0; d--) {
                // Skip vacation days — don't break or count
                if (vacDays.includes(d)) continue;
                const val = entry.tracking[d];
                if (val === 'X' || val === 'x') {
                    streak++;
                } else if (!this.isExpected(week, entry, d)) {
                    continue; // skipped or not scheduled that day — doesn't break the streak
                } else if (weekIdx === sortedWeeks.length - 1 && d === todayIdx) {
                    continue; // today is still in progress
                } else {
                    return streak;
                }
            }
            weekIdx--;
            dayIdx = 6;
        }
        return streak;
    }

    renderStreaks() {
        const container = document.getElementById('streaksGrid');
        if (this.data.weeks.length === 0) { container.innerHTML = ''; return; }

        const week = this.getTodayWeek();
        if (!week) { container.innerHTML = ''; return; }

        const streaks = [];
        Object.values(week.entries).forEach(entry => {
            const streak = this.calculateGoalStreak(entry.goal.name);
            if (streak > 0) streaks.push({ name: entry.goal.name, streak });
        });

        streaks.sort((a, b) => b.streak - a.streak);

        container.innerHTML = streaks.slice(0, 10).map(s => `
            <div class="streak-card">
                <div class="streak-count">${s.streak}</div>
                <div class="streak-label">${s.streak === 1 ? 'day' : 'days'}</div>
                <div class="streak-name">${this.escapeHtml(s.name)}</div>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;font-size:0.85rem;">Start checking off items to build streaks.</div>';
    }

    renderHeatmap() {
        const container = document.getElementById('habitHeatmap');
        const week = this.getTodayWeek();
        if (!week) { container.innerHTML = ''; return; }

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayDayIdx = new Date().getDay();

        // Show heatmap for daily items only (keeps it readable)
        let html = '';
        Object.entries(week.entries).forEach(([idx, entry]) => {
            if (this.scoringKind(entry.goal) !== 'daily') return;
            html += `<div class="heatmap-row">
                <span class="heatmap-label">${this.escapeHtml(entry.goal.name)}</span>
                <div class="heatmap-cells">`;
            for (let i = 0; i < 7; i++) {
                const val = entry.tracking[i];
                const done = val === 'X' || val === 'x';
                const strike = val === '1';
                const isToday = i === todayDayIdx;
                const cls = done ? 'done'
                    : strike ? 'strike'
                    : !this.isExpected(week, entry, i) ? 'off'
                    : (i < todayDayIdx ? 'missed' : '');
                html += `<div class="heatmap-cell ${cls} ${isToday ? 'today' : ''}" title="${days[i]}">${days[i][0]}</div>`;
            }
            html += '</div></div>';
        });

        container.innerHTML = html || '<div class="empty-state" style="padding:12px;font-size:0.85rem;">No daily items found.</div>';
    }

    // ========================================
    // Evening Reflection (Stoic Journal)
    // ========================================
    bindJournal() {
        document.getElementById('saveEveningReflectionBtn').addEventListener('click', () => this.saveEveningReflection());

        // Bind values rating buttons
        document.getElementById('stoicValuesRating').addEventListener('click', (e) => {
            if (e.target.classList.contains('rating-btn')) {
                document.querySelectorAll('#stoicValuesRating .rating-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.saveReflectionDraft();
            }
        });

        // Return in a highlight moves to the next one (the last one closes the keyboard)
        const highlights = [1, 2, 3].map(i => document.getElementById(`stoicHighlight${i}`));
        highlights.forEach((input, i) => input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.isComposing) return;
            e.preventDefault();
            if (highlights[i + 1]) highlights[i + 1].focus();
            else input.blur();
        }));

        // Keep a half-written reflection on this device until it's saved
        document.getElementById('eveningReflectionForm').addEventListener('input', () => {
            if (document.getElementById('stoicSaveNote').textContent) this.setSaveNote('');
            clearTimeout(this._draftTimer);
            this._draftTimer = setTimeout(() => this.saveReflectionDraft(), 400);
        });
        this.restoreReflectionDraft();

        // Archive: load on first open, filter as you type, page through
        const archive = document.getElementById('journalArchive');
        archive.addEventListener('toggle', () => { if (archive.open) this.renderArchive(); });
        document.getElementById('archiveSearch').addEventListener('input', () => {
            this._archiveShown = ARCHIVE_PAGE;
            this.renderArchive();
        });
        document.getElementById('archiveMoreBtn').addEventListener('click', () => {
            this._archiveShown = (this._archiveShown || ARCHIVE_PAGE) + ARCHIVE_PAGE;
            this.renderArchive();
        });
        document.getElementById('archiveList').addEventListener('click', (e) => {
            const card = e.target.closest('.archive-entry');
            if (card) card.classList.toggle('expanded');
        });

        // Import from another journal app (Settings)
        document.getElementById('journalImportBtn').addEventListener('click', () => document.getElementById('journalImportInput').click());
        document.getElementById('journalImportInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            e.target.value = '';
            if (file) this.previewJournalImport(file);
        });
        document.getElementById('journalImportConfirm').addEventListener('click', () => this.confirmJournalImport());
        document.getElementById('journalImportCancel').addEventListener('click', () => this.closeModal('journalImportModal'));
        document.getElementById('journalClearBtn').addEventListener('click', () => this.clearJournalArchive());
    }

    saveEveningReflection() {
        const wentWell = document.getElementById('stoicWentWell')?.value?.trim();
        const fellShort = document.getElementById('stoicFellShort')?.value?.trim();
        const highlights = [1, 2, 3]
            .map(i => document.getElementById(`stoicHighlight${i}`)?.value?.trim())
            .filter(Boolean);
        const intention = document.getElementById('stoicIntention')?.value?.trim();

        const ratingBtn = document.querySelector('#stoicValuesRating .rating-btn.active');
        const valuesRating = ratingBtn ? parseInt(ratingBtn.dataset.rating) : null;

        if (!wentWell && !fellShort && highlights.length === 0) {
            this.setSaveNote('Write at least one line first.', true);
            document.getElementById('stoicWentWell').focus();
            return;
        }

        const now = new Date();
        const open = this.reflectionDay(now);
        const picked = document.getElementById('reflectDay').value;
        const day = picked ? new Date(`${picked}T12:00:00`) : open;
        const reflection = {
            date: this.localDateKey(day),
            timestamp: now.toISOString(),
            ...(this.localDateKey(day) < this.localDateKey(open) && { backdated: true }), // written later, for an earlier day
            wentWell,
            fellShort,
            highlights,
            valuesRating,
            intention
        };

        this.data.eveningReflections.unshift(reflection);
        const checked = this.checkOffGoal(/evening reflection/i, day);

        // Also save as a journal entry for unified history
        const highlightText = highlights.map((h, i) => `${i + 1}. ${h}`).join('\n') || '-';
        this.data.journalEntries.unshift({
            date: reflection.date,
            timestamp: reflection.timestamp,
            text: `**What went well:** ${wentWell || '-'}\n\n**Where I fell short:** ${fellShort || '-'}\n\n**Highlights / to remember:**\n${highlightText}\n\n**Values Rating:** ${valuesRating || '-'}/10\n\n**Tomorrow's Intention:** ${intention || '-'}`,
            mood: valuesRating >= 7 ? 'good' : valuesRating >= 5 ? 'okay' : 'low',
            type: 'stoic'
        });

        this.saveData();
        this.logActivity('Completed evening reflection');

        // Clear form (and the draft)
        clearTimeout(this._draftTimer);
        this.setLocal('lifeOS_reflectionDraft', '');
        REFLECTION_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = ''; if (el.matches('textarea.autogrow')) this.autoGrow(el); }
        });
        document.querySelectorAll('#stoicValuesRating .rating-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('reflectDay').selectedIndex = 0;
        document.activeElement?.blur?.();

        this.renderJournal();
        if (checked) this.updateAppBadge();
        const streak = this.getJournalStreak().current;
        this.setSaveNote(['Saved', streak > 1 ? `${streak} days in a row` : '', checked ? `checked off for ${this.dayWord(day, now)} ✓` : '']
            .filter(Boolean).join(' · '));
    }

    // Quiet status line under the Save button (replaces pop-ups)
    setSaveNote(text, warn = false) {
        const note = document.getElementById('stoicSaveNote');
        note.textContent = text;
        note.classList.toggle('warn', warn);
    }

    saveReflectionDraft() {
        const fields = Object.fromEntries(REFLECTION_FIELDS.map(id => [id, document.getElementById(id)?.value || '']));
        const rating = document.querySelector('#stoicValuesRating .rating-btn.active')?.dataset.rating || '';
        const empty = !rating && Object.values(fields).every(v => !v.trim());
        const day = document.getElementById('reflectDay').value;
        this.setLocal('lifeOS_reflectionDraft', empty ? '' : JSON.stringify({ savedAt: Date.now(), fields, rating, day }));
    }

    // Put back a reflection left half-written in the last 24 hours
    restoreReflectionDraft() {
        let draft = null;
        try { draft = JSON.parse(this.getLocal('lifeOS_reflectionDraft') || 'null'); } catch (e) { /* ignore */ }
        if (!draft?.fields || Date.now() - draft.savedAt > 24 * 3600e3) return;
        REFLECTION_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el && draft.fields[id]) el.value = draft.fields[id];
        });
        if (draft.rating) document.querySelector(`#stoicValuesRating .rating-btn[data-rating="${draft.rating}"]`)?.classList.add('active');
        if (draft.day) {
            this.fillReflectDays();
            const select = document.getElementById('reflectDay');
            if ([...select.options].some(o => o.value === draft.day)) select.value = draft.day;
        }
        this.setSaveNote('Picked up where you left off.');
    }

    // ---- Journal streak ----

    // Local days with a saved reflection or an imported entry
    getJournalDays() {
        const days = new Set(this.data.journalImportDates || []);
        (this.data.eveningReflections || []).forEach(r => {
            days.add(this.reflectionKey(r));
        });
        days.delete(undefined);
        return days;
    }

    shiftDateKey(key, n) {
        const d = new Date(`${key}T12:00:00`);
        d.setDate(d.getDate() + n);
        return this.localDateKey(d);
    }

    // current: consecutive days up to today (today not done yet doesn't break it)
    getJournalStreak() {
        const days = this.getJournalDays();
        const today = this.localDateKey(this.reflectionDay());
        const doneToday = days.has(today);
        let current = 0;
        for (let key = doneToday ? today : this.shiftDateKey(today, -1); days.has(key); key = this.shiftDateKey(key, -1)) current++;

        let best = 0, run = 0, prev = null;
        [...days].sort().forEach(key => {
            run = prev && this.shiftDateKey(prev, 1) === key ? run + 1 : 1;
            best = Math.max(best, run);
            prev = key;
        });
        return { current, best, total: days.size, doneToday, days };
    }

    renderJournalStreak() {
        const el = document.getElementById('journalStreak');
        if (!el) return;
        const s = this.getJournalStreak();
        const today = this.localDateKey(new Date());
        const dots = [];
        for (let i = 13; i >= 0; i--) {
            const key = this.shiftDateKey(today, -i);
            const label = new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
            const cls = s.days.has(key) ? 'on' : i === 0 ? 'today' : '';
            dots.push(`<span class="streak-dot ${cls}" title="${key}">${label}</span>`);
        }
        const note = s.current === 0 ? 'Write tonight to start a streak.'
            : s.doneToday ? 'Done for today.'
            : 'Reflect tonight to keep it going.';
        el.innerHTML = `
            <div class="journal-streak-main">
                <div class="journal-streak-count">${s.current}</div>
                <div>
                    <div class="journal-streak-label">${s.current === 1 ? 'day' : 'days'} in a row</div>
                    <div class="journal-streak-note">${note}</div>
                    <div class="journal-streak-meta">
                        <span>Best <b>${s.best}</b></span>
                        <span><b>${s.total}</b> days journaled</span>
                    </div>
                </div>
            </div>
            <div class="streak-dots">${dots.join('')}</div>`;
    }

    // "Reflecting on": today (or tonight, until 3 AM) and the 6 days before it, for catching up
    fillReflectDays() {
        const select = document.getElementById('reflectDay');
        const keep = select.selectedIndex > 0 ? select.value : ''; // a day picked on purpose; the default moves with the clock
        const late = this.isLateNight();
        const open = this.reflectionDay();
        select.innerHTML = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(open);
            d.setDate(d.getDate() - i);
            const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const label = i === 0 ? `${late ? 'Tonight' : 'Today'} · ${date}` : i === 1 && !late ? `Yesterday · ${date}` : date;
            return `<option value="${this.localDateKey(d)}">${label}</option>`;
        }).join('');
        if ([...select.options].some(o => o.value === keep)) select.value = keep;
    }

    renderJournal() {
        this.renderJournalStreak();
        this.updateArchiveSummary();
        this.fillReflectDays();
        const late = document.getElementById('lateNightNote');
        late.hidden = !this.isLateNight();
        if (!late.hidden) late.textContent = `It's past midnight, so tonight is still ${this.reflectionDay().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.`;

        const container = document.getElementById('journalEntriesList');
        const entries = this.data.eveningReflections;

        if (!entries || entries.length === 0) {
            container.innerHTML = '<div class="empty-state">Complete your first evening reflection to see your history.</div>';
            return;
        }

        // Newest day first, so an entry written later sits under the day it's for
        const byDay = entries.slice().sort((a, b) => String(this.reflectionKey(b)).localeCompare(String(this.reflectionKey(a))));
        container.innerHTML = byDay.slice(0, 20).map(entry => {
            const dateStr = entry.timestamp
                ? new Date(`${this.reflectionKey(entry)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : entry.date;
            const writtenLater = entry.backdated && entry.timestamp
                ? `<small class="journal-entry-late">written ${new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>`
                : '';
            const highlights = entry.highlights?.length
                ? `<p><strong>Highlights:</strong></p><ol class="highlight-list">${entry.highlights.map(h => `<li>${this.escapeHtml(h)}</li>`).join('')}</ol>`
                : entry.gratitude ? `<p><strong>Grateful for:</strong> ${this.escapeHtml(entry.gratitude)}</p>` : '';

            return `<div class="journal-entry-card">
                <div class="journal-entry-header">
                    <span class="journal-entry-date">${dateStr}${writtenLater}</span>
                    ${entry.valuesRating ? `<span class="journal-entry-mood">Values: ${entry.valuesRating}/10</span>` : ''}
                </div>
                <div class="journal-entry-text">
                    ${entry.wentWell ? `<p><strong>Went well:</strong> ${this.escapeHtml(entry.wentWell)}</p>` : ''}
                    ${entry.fellShort ? `<p><strong>Fell short:</strong> ${this.escapeHtml(entry.fellShort)}</p>` : ''}
                    ${highlights}
                    ${entry.intention ? `<p><strong>Tomorrow:</strong> ${this.escapeHtml(entry.intention)}</p>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ---- Journal archive (entries imported from another app) ----
    // Text lives in Convex (journalArchive table) or, without Convex, in localStorage —
    // never in the main data blob. data.journalImportDates keeps just the dates for the streak.

    async loadArchive(force = false) {
        if (this._archive && !force) return this._archive;
        if (this.convex) {
            this._archive = await this.convex.query('journal:listArchive');
        } else {
            try { this._archive = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || '[]'); } catch (e) { this._archive = []; }
            this._archive.sort((a, b) => b.date.localeCompare(a.date));
        }
        return this._archive;
    }

    updateArchiveSummary() {
        const n = (this.data.journalImportDates || []).length;
        const details = document.getElementById('journalArchive');
        details.hidden = n === 0;
        document.getElementById('journalClearBtn').style.display = n > 0 ? 'inline-block' : 'none';
        if (n > 0 && this._archive) document.getElementById('archiveCount').textContent = `${this._archive.length} entries`;
        else if (n > 0) document.getElementById('archiveCount').textContent = `${n} days`;
        if (details.open && !details.hidden) this.renderArchive();
    }

    async renderArchive() {
        const list = document.getElementById('archiveList');
        const moreBtn = document.getElementById('archiveMoreBtn');
        if (!this._archive) list.innerHTML = '<div class="empty-state">Loading…</div>';
        let entries;
        try {
            entries = await this.loadArchive();
        } catch (e) {
            list.innerHTML = `<div class="empty-state">Couldn't load the archive (${this.escapeHtml(e.message)}).</div>`;
            return;
        }
        document.getElementById('archiveCount').textContent = `${entries.length} entries`;
        const q = document.getElementById('archiveSearch').value.trim().toLowerCase();
        const matches = q ? entries.filter(e => e.text.toLowerCase().includes(q) || e.date.includes(q)) : entries;
        const shown = matches.slice(0, this._archiveShown || ARCHIVE_PAGE);
        list.innerHTML = shown.map(e => `
            <article class="archive-entry">
                <div class="archive-date">${new Date(`${e.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div class="archive-text">${this.escapeHtml(e.text)}</div>
            </article>`).join('') || `<div class="empty-state">No entries match "${this.escapeHtml(q)}".</div>`;
        moreBtn.style.display = matches.length > shown.length ? 'block' : 'none';
    }

    setJournalImportStatus(text, tone) {
        const el = document.getElementById('journalImportStatus');
        el.textContent = text;
        el.style.color = tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--danger)' : 'var(--text-muted)';
    }

    // Read the file, split it into dated entries and show a preview before saving
    async previewJournalImport(file) {
        this.setJournalImportStatus(`Reading ${file.name}…`);
        try {
            const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
            const pages = isPdf ? await this.pdfToLines(file) : [(await file.text()).split(/\r?\n/)];
            const entries = this.parseJournalEntries(pages);
            if (entries.length === 0) {
                this.setJournalImportStatus('No dated entries found in that file. Send a sample page and the importer can be adjusted.', 'warn');
                return;
            }
            this._pendingImport = { entries, source: 'Journal app' };
            const fmt = key => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
            document.getElementById('journalImportSummary').textContent =
                `Found ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from ${fmt(sorted[0].date)} to ${fmt(sorted.at(-1).date)}.`;
            const sample = entries.length > 3 ? [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted.at(-1)] : sorted;
            document.getElementById('journalImportPreview').innerHTML = sample.map(e => `
                <div class="archive-entry">
                    <div class="archive-date">${fmt(e.date)}</div>
                    <div class="archive-text">${this.escapeHtml(e.text.slice(0, 280))}${e.text.length > 280 ? '…' : ''}</div>
                </div>`).join('');
            this.setJournalImportStatus('');
            this.openModal('journalImportModal');
        } catch (err) {
            this.setJournalImportStatus('Could not read that file: ' + err.message, 'warn');
        }
    }

    async confirmJournalImport() {
        const pending = this._pendingImport;
        if (!pending) return;
        const btn = document.getElementById('journalImportConfirm');
        btn.disabled = true;
        btn.textContent = 'Importing…';
        try {
            let added = 0, skipped = 0;
            if (this.convex) {
                for (let i = 0; i < pending.entries.length; i += 50) {
                    const r = await this.convex.mutation('journal:importEntries', {
                        entries: pending.entries.slice(i, i + 50), source: pending.source
                    });
                    added += r.added;
                    skipped += r.skipped;
                }
            } else {
                const existing = await this.loadArchive(true);
                const keys = new Set(existing.map(e => `${e.date}:${e.text}`));
                pending.entries.forEach(e => {
                    if (keys.has(`${e.date}:${e.text}`)) { skipped++; return; }
                    existing.push({ ...e, source: pending.source });
                    keys.add(`${e.date}:${e.text}`);
                    added++;
                });
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(existing));
            }
            const dates = new Set(this.data.journalImportDates || []);
            pending.entries.forEach(e => dates.add(e.date));
            this.data.journalImportDates = [...dates].sort();
            this._archive = null;
            this._pendingImport = null;
            this.saveData();
            this.logActivity(`Imported ${added} journal entr${added === 1 ? 'y' : 'ies'}`);
            this.closeModal('journalImportModal');
            this.setJournalImportStatus(`Imported ${added} entr${added === 1 ? 'y' : 'ies'}${skipped ? ` (${skipped} already there)` : ''}. They're under Journal archive on the Reflection tab.`, 'ok');
            this.renderJournal();
        } catch (err) {
            this.setJournalImportStatus('Import failed: ' + err.message, 'warn');
        }
        btn.disabled = false;
        btn.textContent = 'Import';
    }

    async clearJournalArchive() {
        if (!confirm('Remove all imported journal entries? Your Life OS reflections are not affected.')) return;
        try {
            if (this.convex) {
                let remaining = 1;
                while (remaining > 0) ({ remaining } = await this.convex.mutation('journal:clearArchive', {}));
            } else {
                localStorage.removeItem(ARCHIVE_STORAGE_KEY);
            }
            this.data.journalImportDates = [];
            this._archive = null;
            this.saveData();
            this.logActivity('Removed imported journal entries');
            this.setJournalImportStatus('Imported entries removed.', 'ok');
            this.renderJournal();
        } catch (err) {
            this.setJournalImportStatus('Could not remove entries: ' + err.message, 'warn');
        }
    }

    // ---- Parsing exported journals ----

    // pdf.js is only loaded when a PDF is imported
    loadPdfJs() {
        if (!this._pdfjs) {
            this._pdfjs = import(`${PDFJS_BASE}/pdf.min.mjs`).then(lib => {
                lib.GlobalWorkerOptions.workerSrc = new URL(`${PDFJS_BASE}/pdf.worker.min.mjs`, document.baseURI).href;
                return lib;
            });
            this._pdfjs.catch(() => { this._pdfjs = null; });
        }
        return this._pdfjs;
    }

    // [[line, line, …] per page]
    async pdfToLines(file) {
        const lib = await this.loadPdfJs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pages = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const content = await (await pdf.getPage(p)).getTextContent();
            const lines = [];
            let line = '';
            content.items.forEach(item => {
                line += item.str;
                if (item.hasEOL) { lines.push(line.trim()); line = ''; }
            });
            if (line.trim()) lines.push(line.trim());
            pages.push(lines);
        }
        return pages;
    }

    // Split exported text into { date: 'YYYY-MM-DD', text } at each line that is a date heading
    parseJournalEntries(pages) {
        // Lines repeated on most pages are headers/footers; bare numbers are page numbers
        const seen = new Map();
        pages.forEach(lines => new Set(lines).forEach(l => seen.set(l, (seen.get(l) || 0) + 1)));
        const repeated = pages.length >= 3
            ? new Set([...seen].filter(([, n]) => n >= Math.max(3, pages.length / 2)).map(([l]) => l))
            : new Set();
        const pageNumber = /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i;

        const entries = [];
        let current = null;
        pages.flat().forEach(raw => {
            const line = (raw || '').trim();
            if (repeated.has(line) || pageNumber.test(line)) return;
            const heading = this.parseDateHeading(line);
            if (heading) {
                if (current) entries.push(current);
                current = { date: heading.date, lines: heading.rest ? [heading.rest] : [] };
            } else if (current) {
                current.lines.push(line);
            }
        });
        if (current) entries.push(current);
        return entries
            .map(e => ({ date: e.date, text: e.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
            .filter(e => e.text);
    }

    // A line that starts with a date and has nothing but a time after it → { date, rest }
    parseDateHeading(line) {
        if (!line || line.length > 80) return null;
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const M = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
        const W = '(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?,?\\s+)?';
        const patterns = [
            [new RegExp(`^${W}${M}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i'), m => [m[3], months.indexOf(m[1].toLowerCase()) + 1, m[2]]],
            [new RegExp(`^${W}(\\d{1,2})(?:st|nd|rd|th)?\\s+${M},?\\s+(\\d{4})`, 'i'), m => [m[3], months.indexOf(m[2].toLowerCase()) + 1, m[1]]],
            [/^(\d{4})-(\d{1,2})-(\d{1,2})/, m => [m[1], m[2], m[3]]],
            [new RegExp(`^${W}(\\d{1,2})/(\\d{1,2})/(\\d{4}|\\d{2})\\b`, 'i'), m => [m[3].length === 2 ? '20' + m[3] : m[3], m[1], m[2]]]
        ];
        for (const [re, pick] of patterns) {
            const m = line.match(re);
            if (!m) continue;
            const [y, mo, d] = pick(m).map(Number);
            const date = new Date(y, mo - 1, d);
            if (y < 1990 || y > 2100 || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
            // Allow a trailing time ("at 9:41 PM", "· 21:41"); anything else means it's prose
            const rest = line.slice(m[0].length).replace(/^[\s,·•|–—-]*(at\s+)?(\d{1,2}[:.]\d{2}(\s*[ap]\.?m\.?)?)?[\s,·•|–—-]*/i, '');
            if (rest.length > 0) return null;
            return { date: this.localDateKey(date), rest: '' };
        }
        return null;
    }

    // ========================================
    // Meditate (guided sessions, spoken with the device's voice)
    // ========================================
    bindMeditation() {
        document.querySelectorAll('[data-goto]').forEach(el =>
            el.addEventListener('click', () => this.navigateTo(el.dataset.goto)));
        document.getElementById('medLengths').addEventListener('click', (e) => {
            const btn = e.target.closest('.med-length');
            if (!btn) return;
            this.setLocal('lifeOS_medLength', btn.dataset.min);
            this.renderMeditation();
        });
        document.getElementById('medSessions').addEventListener('click', (e) => {
            const card = e.target.closest('[data-med]');
            if (card) this.startMeditation(card.dataset.med, this.getMedLength());
        });
        document.getElementById('medVoice').addEventListener('change', (e) => this.setLocal('lifeOS_medVoiceChoice', e.target.value));
        document.getElementById('medVoiceOn').addEventListener('change', (e) => this.setLocal('lifeOS_medVoiceOn', e.target.checked ? '1' : '0'));
        document.getElementById('medVoiceTest').addEventListener('click', () => this.medSoundCheck());
        document.getElementById('medPauseBtn').addEventListener('click', () => this._med?.paused ? this.medResume() : this.medPause());
        document.getElementById('medEndBtn').addEventListener('click', () => this.medStop());
        document.getElementById('medDoneBtn').addEventListener('click', () => this.closeMedPlayer());
        if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => this.renderMedVoices());
        // Locking the phone or switching apps pauses the session
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this._med?.running && !this._med.paused) this.medPause();
        });
    }

    getLocal(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    setLocal(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
    }

    getMedLength() {
        const min = parseInt(this.getLocal('lifeOS_medLength'));
        return [1, 3, 5].includes(min) ? min : 3;
    }

    renderMeditation() {
        const min = this.getMedLength();
        document.querySelectorAll('.med-length').forEach(b => {
            const on = parseInt(b.dataset.min) === min;
            b.classList.toggle('active', on);
            b.setAttribute('aria-checked', on);
        });
        document.getElementById('medSessions').innerHTML = Object.entries(MEDITATIONS).map(([key, m]) => `
            <button class="med-card" data-med="${key}">
                <span class="med-card-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${m.icon}</svg></span>
                <span class="med-card-text"><b>${m.title}</b><small>${m.themes ? `Today: ${this.themeOfDay(m.themes).title}` : m.blurb}</small></span>
                <span class="med-card-len">${min} min</span>
            </button>`).join('');

        // This week's sessions
        const weekStart = this.localDateKey(this.getWeekStartDate(new Date()));
        const log = this.data.meditationLog || [];
        const thisWeek = log.filter(s => s.date >= weekStart);
        const minutes = thisWeek.reduce((n, s) => n + s.minutes, 0);
        document.getElementById('medStats').textContent = log.length
            ? `This week: ${thisWeek.length} session${thisWeek.length === 1 ? '' : 's'} · ${minutes} min. 3- and 5-minute sessions check off Meditate in Today.`
            : '3- and 5-minute sessions check off Meditate in Today.';
        if (this.isLateNight()) document.getElementById('medStats').textContent += ` Until ${LATE_NIGHT_HOURS} AM, sessions count for ${this.reflectionDayName()}.`;

        document.getElementById('medVoiceOn').checked = this.getLocal('lifeOS_medVoiceOn') !== '0';
        this.renderMedVoices();
        this.loadMedManifest();
    }

    // English voices, nicest first (Premium / Enhanced, then well-known calm voices)
    getMedVoices() {
        if (!window.speechSynthesis) return [];
        const preferred = ['Ava', 'Zoe', 'Samantha', 'Allison', 'Susan', 'Serena', 'Karen', 'Moira', 'Daniel'];
        const rank = v => (/premium/i.test(v.name) ? 0 : /enhanced/i.test(v.name) ? 1 : 2) * 100
            + (preferred.findIndex(p => v.name.includes(p)) + 1 || 50) + (v.lang === 'en-US' ? 0 : 0.5);
        return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)).sort((a, b) => rank(a) - rank(b));
    }

    // 'recorded' = Cori's bundled recordings (the default; plays like the chimes, so it works
    // in the iPhone Home Screen app). Anything else is a device voice's voiceURI, which only
    // works where speechSynthesis does (desktop browsers, Safari tabs).
    medVoiceChoice() {
        return this.getLocal('lifeOS_medVoiceChoice') || 'recorded';
    }

    medUsesRecordings() {
        return this.medVoiceChoice() === 'recorded';
    }

    medVoice() {
        const voices = this.getMedVoices();
        const choice = this.medVoiceChoice();
        return voices.find(v => v.voiceURI === choice) || voices[0] || null;
    }

    renderMedVoices() {
        const select = document.getElementById('medVoice');
        const device = this.getMedVoices();
        select.innerHTML = '<option value="recorded">Cori — calm recorded voice (recommended)</option>' + (device.length
            ? `<optgroup label="Device voices (may be silent in the Home Screen app)">${device.map(v =>
                `<option value="${this.escapeHtml(v.voiceURI)}">${this.escapeHtml(v.name)} (${v.lang})</option>`).join('')}</optgroup>`
            : '');
        const choice = this.medVoiceChoice();
        select.value = [...select.options].some(o => o.value === choice) ? choice : 'recorded';
    }

    // ---- Recorded voice ----
    loadMedManifest() {
        if (!this._medManifestPromise) {
            this._medManifestPromise = fetch(MED_AUDIO_BASE + 'manifest.json')
                .then(r => (r.ok ? r.json() : null))
                .then(m => (this._medManifest = m?.lines || null))
                .catch(() => (this._medManifest = null));
        }
        return this._medManifestPromise;
    }

    medAudioContext() {
        if (!this._medAudio) this._medAudio = new (window.AudioContext || window.webkitAudioContext)();
        return this._medAudio;
    }

    // Decoded recording of a line (fetched once), or null if there isn't one.
    // Why the last one failed is kept in _medClipError for the player's hint.
    medClip(text) {
        this._medClips ||= new Map();
        this._medClipReady ||= new Map();
        if (!this._medClips.has(text)) {
            const clip = this.loadMedManifest().then(async lines => {
                if (!lines) throw new Error("couldn't load the recordings list");
                const file = lines[text];
                if (!file) throw new Error('no recording for this line');
                const resp = await fetch(MED_AUDIO_BASE + file);
                if (!resp.ok) throw new Error(`download failed, ${resp.status}`);
                const buffer = await this.medDecode(await resp.arrayBuffer());
                this._medClipReady.set(text, buffer);
                return buffer;
            }).catch(e => {
                this._medClipError = e?.message || String(e?.name || e || 'unknown error');
                this._medClips.delete(text); // retry next time
                if (!this._medManifest) this._medManifestPromise = null;
                return null;
            });
            this._medClips.set(text, clip);
        }
        return this._medClips.get(text);
    }

    // One decode at a time, callback form: iPhone Safari can fail when a whole session's
    // lines are decoded at once, and older versions don't return a promise
    medDecode(arrayBuffer) {
        const ctx = this.medAudioContext();
        const run = () => new Promise((resolve, reject) => {
            const fail = e => reject(new Error(`couldn't decode the audio${e?.message ? `: ${e.message}` : ''}`));
            const result = ctx.decodeAudioData(arrayBuffer, resolve, fail);
            if (result?.catch) result.catch(fail);
        });
        const next = (this._medDecodeQueue || Promise.resolve()).then(run, run);
        this._medDecodeQueue = next.catch(() => {});
        return next;
    }

    // Make sure the audio engine is running before a line plays (iPhone can suspend or
    // interrupt it); gives up after a second and reports the state it's stuck in
    async medAudioReady() {
        let ctx;
        try { ctx = this.medAudioContext(); } catch (e) { return 'unavailable'; }
        if (ctx.state === 'running') return 'running';
        try {
            await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 1000))]);
        } catch (e) { /* reported below */ }
        return ctx.state;
    }

    // Wait for a promise, but no longer than `ms` (resolves to `fallback` on timeout)
    medWithin(promise, ms, fallback = null) {
        return Promise.race([promise, new Promise(r => setTimeout(() => r(fallback), ms))]);
    }

    // Tell the listener exactly why they can't hear the voice (captions keep going)
    medVoiceProblem(text) {
        const m = this._med;
        if (!m || m.cancelled) return;
        m.voiceProblem = text;
        const hint = document.getElementById('medHint');
        hint.textContent = text;
        hint.hidden = false;
    }

    medPlayBuffer(buffer, offset = 0, delay = 0) {
        const ctx = this.medAudioContext();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(ctx.currentTime + delay, offset);
        return source;
    }

    medStopVoice() {
        const m = this._med;
        [m?.source, m?.cueSource].forEach(src => { try { src?.stop(); } catch (e) { /* already stopped */ } });
        if (window.speechSynthesis) speechSynthesis.cancel();
    }

    medUtterance(text) {
        const u = new SpeechSynthesisUtterance(text);
        const voice = this.medVoice();
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        u.rate = 0.88;
        return u;
    }

    // Rough speaking time at the calm rate we use
    medSpeechSeconds(text) {
        return text.split(/\s+/).length / 2.3 + 0.4;
    }

    medEstimate(step) {
        if (step.say) return this.medSpeechSeconds(step.say) + (step.pause ?? 1);
        if (step.breathe && step.cycles) return step.cycles * BREATH_PATTERNS[step.breathe].reduce((t, p) => t + p.seconds, 0);
        return 0;
    }

    // ---- Session clock (pause-aware; _medTimeScale > 1 only in tests) ----
    medElapsed() {
        const m = this._med;
        const running = m.paused ? 0 : performance.now() - m.resumedAt;
        return (m.accumulated + running) / 1000 * (this._medTimeScale || 1);
    }

    medSleep(seconds) {
        return this.medSleepUntil(this.medElapsed() + seconds);
    }

    // Wait until the session clock reaches `until` (seconds), holding while paused
    async medSleepUntil(until) {
        const m = this._med;
        while (!m.cancelled && (m.paused || this.medElapsed() < until)) {
            await new Promise(r => setTimeout(r, m.paused ? 200 : Math.min(100, Math.max(1, (until - this.medElapsed()) * 1000 / (this._medTimeScale || 1)))));
        }
    }

    // iPhone rules: sound must start from a tap, and web audio follows the silent switch
    // unless the page is playing media. So, from the tap: ask for media playback, start a
    // silent loop, and wake the audio and speech engines.
    medPrimeAudio() {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
        try {
            if (!this._medSilence) {
                this._medSilence = new Audio(this.silentWavUrl());
                this._medSilence.loop = true;
            }
            const playing = this._medSilence.play();
            if (playing && playing.catch) playing.catch(() => {});
        } catch (e) { /* no media playback */ }
        try {
            const ctx = this.medAudioContext();
            if (ctx.state !== 'running') ctx.resume();
        } catch (e) { /* no Web Audio */ }
        if (window.speechSynthesis && speechSynthesis.paused) speechSynthesis.resume();
    }

    medReleaseAudio() {
        if (this._medSilence) this._medSilence.pause();
        try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* older iOS */ }
    }

    // Half a second of silent 8-bit mono WAV, made once
    silentWavUrl() {
        if (this._silentWav) return this._silentWav;
        const rate = 8000, n = rate / 2;
        const buf = new ArrayBuffer(44 + n);
        const v = new DataView(buf);
        const str = (offset, text) => [...text].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
        str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
        str(36, 'data'); v.setUint32(40, n, true);
        new Uint8Array(buf, 44).fill(128);
        this._silentWav = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
        return this._silentWav;
    }

    // "Test" button: chime + a spoken line, and say what actually happened
    async medSoundCheck() {
        const status = document.getElementById('medVoiceStatus');
        this.medPrimeAudio();
        this.medChime();
        if (this.medUsesRecordings()) {
            status.textContent = 'Testing…';
            const buffer = await this.medClip(MED_TEST_LINE);
            if (!buffer) {
                status.textContent = `Couldn't load the voice recordings (${this._medClipError || 'unknown error'}). Check your connection and tap Test again.`;
                return;
            }
            this.medPlayBuffer(buffer, 0, 0.6);
            status.textContent = 'Playing…';
            setTimeout(() => {
                status.textContent = this.getLocal('lifeOS_medVoiceOn') === '0'
                    ? '✓ Voice played — but “Speak the guidance” below is off, so sessions are silent. Tick it to hear Cori in sessions.'
                    : '✓ Voice played. Heard nothing? Turn the volume up with the side buttons and tap Test again.';
                this.medReleaseAudio();
            }, (buffer.duration + 0.9) * 1000);
            return;
        }
        if (!window.speechSynthesis) {
            status.textContent = "This browser can't speak. Sessions will show captions only.";
            return;
        }
        const u = this.medUtterance('Take a slow breath in, and let it go.');
        let started = false;
        u.onstart = () => { started = true; status.textContent = 'Speaking…'; };
        u.onend = () => {
            status.textContent = started ? '✓ The voice is working.' : 'The voice ran but made no sound. See the tips below.';
            this.medReleaseAudio();
        };
        u.onerror = (e) => { status.textContent = `The voice couldn't play (${e.error || 'unknown error'}). See the tips below.`; };
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        speechSynthesis.speak(u);
        status.textContent = 'Testing…';
        setTimeout(() => {
            if (!started) status.textContent = "No voice yet. Turn the volume up with the side buttons, then tap Test again.";
        }, 4000);
    }

    async medSpeak(text) {
        const m = this._med;
        document.getElementById('medCaption').textContent = text;
        if (!m.voiceOn) return this.medSleep(this.medSpeechSeconds(text));
        if (this.medUsesRecordings()) {
            // Never hold the session up for a slow download: after 8s, show captions and move on
            let buffer = await this.medWithin(this.medClip(text), 8000);
            if (!buffer && !m.cancelled && !this._medClips?.has(text)) buffer = await this.medWithin(this.medClip(text), 8000); // one retry
            if (m.cancelled) return;
            if (!buffer) {
                this.medVoiceProblem(`Couldn't load the voice (${this._medClips?.has(text) ? 'still downloading' : this._medClipError || 'unknown error'}). The captions keep going — check your connection.`);
                return this.medSleep(this.medSpeechSeconds(text)); // captions only
            }
            const state = await this.medAudioReady();
            if (m.cancelled) return;
            if (state !== 'running') {
                this.medVoiceProblem(`The iPhone paused the sound (${state}). Tap Pause, then Resume, to wake it.`);
            } else {
                m.heardVoice = true;
                m.voiceProblem = null;
                document.getElementById('medHint').hidden = true;
            }
            (m.played ||= []).push(text);
            // Timed on the session clock, so Pause/Resume can pick the line up where it stopped
            m.line = { buffer, startedAt: this.medElapsed() };
            m.source = m.paused ? null : this.medPlayBuffer(buffer); // paused while loading: Resume starts it
            await this.medSleepUntil(m.line.startedAt + buffer.duration);
            m.line = null;
            return;
        }
        if (!window.speechSynthesis) return this.medSleep(this.medSpeechSeconds(text));
        return new Promise(resolve => {
            const u = this.medUtterance(text);
            let finished = false;
            const done = () => { if (!finished) { finished = true; clearTimeout(timer); resolve(); } };
            // iOS sometimes skips onend — never wait forever
            const timer = setTimeout(done, (this.medSpeechSeconds(text) * 2 + 4) * 1000);
            u.onstart = () => { this._med.heardVoice = true; };
            u.onend = done;
            u.onerror = done;
            speechSynthesis.speak(u);
        });
    }

    medCue(text) {
        const m = this._med;
        if (!text || !m.voiceOn) return;
        if (this.medUsesRecordings()) {
            const buffer = this._medClipReady?.get(text); // preloaded at start; skip if not ready
            if (buffer) {
                (m.played ||= []).push(text);
                m.cueSource = this.medPlayBuffer(buffer);
            }
            return;
        }
        if (!window.speechSynthesis) return;
        // Skip a cue rather than cut speech off: on iPhone, cancel() then speak() drops the new line
        if (speechSynthesis.speaking || speechSynthesis.pending) return;
        speechSynthesis.speak(this.medUtterance(text));
    }

    async medBreathe(step, maxSeconds = Infinity) {
        const m = this._med;
        const phases = BREATH_PATTERNS[step.breathe];
        const cycleLength = phases.reduce((t, p) => t + p.seconds, 0);
        const orb = document.getElementById('medOrb');
        const label = document.getElementById('medPhase');
        // Phases are scheduled against fixed times so small timer delays never add up
        const start = this.medElapsed();
        let t = start;
        for (let cycle = 0; !m.cancelled; cycle++) {
            if (step.cycles ? cycle >= step.cycles : t - start + cycleLength > maxSeconds) break;
            for (const phase of phases) {
                if (m.cancelled) return;
                orb.style.transitionDuration = `${phase.seconds / (this._medTimeScale || 1)}s`;
                orb.style.transform = `scale(${phase.scale})`;
                label.textContent = phase.label;
                if (cycle < (step.cues || 0)) this.medCue(phase.cue);
                t += phase.seconds;
                await this.medSleepUntil(t);
            }
        }
        label.textContent = '';
    }

    async medRunStep(step) {
        if (step.say) {
            await this.medSpeak(step.say);
            await this.medSleep(step.pause ?? 1);
        } else if (step.breathe) {
            await this.medBreathe(step);
        }
    }

    medChime(soft = false) {
        try {
            const ctx = this._medAudio || (this._medAudio = new (window.AudioContext || window.webkitAudioContext)());
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            [[528, 0.22], [792, 0.08], [1056, 0.05]].forEach(([freq, level]) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(level * (soft ? 0.5 : 1), now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 3.3);
            });
        } catch (e) { /* no audio */ }
    }

    // Called straight from the tap, so iOS allows audio and speech
    async startMeditation(kind, minutes) {
        const session = MEDITATIONS[kind];
        if (!session || this._med?.running) return;
        const voiceOn = this.getLocal('lifeOS_medVoiceOn') !== '0';
        const theme = session.themes && this.themeOfDay(session.themes);
        this._med = { kind, minutes, theme, voiceOn, running: true, paused: false, cancelled: false, accumulated: 0, resumedAt: performance.now() };
        const m = this._med;

        document.getElementById('medTitle').textContent = `${session.title} · ${minutes} min`;
        document.getElementById('medCaption').textContent = '';
        document.getElementById('medPhase').textContent = '';
        document.getElementById('medOrb').style.transform = 'scale(0.75)';
        document.getElementById('medStage').hidden = false;
        document.getElementById('medDone').hidden = true;
        document.getElementById('medControls').hidden = false;
        document.getElementById('medPauseBtn').textContent = 'Pause';
        document.getElementById('medPlayer').hidden = false;
        document.body.classList.add('med-open');

        const hint = document.getElementById('medHint');
        this._medHintText ||= hint.textContent;
        hint.textContent = this._medHintText;
        hint.hidden = true;
        this.medPrimeAudio();
        this.medChime(session.gentle);
        if (!voiceOn) this.medVoiceProblem('Voice is off. Turn on “Speak the guidance” on the Meditate page to hear Cori.');

        const total = minutes * 60;
        const tick = () => {
            const left = Math.max(0, Math.ceil(total - this.medElapsed()));
            document.getElementById('medRemaining').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        };
        tick();
        m.tick = tick;
        m.ticker = setInterval(tick, 250);

        const steps = session.build(minutes, theme);
        const closingAt = steps.findIndex(s => s.closing);
        const main = steps.slice(0, closingAt);
        const closing = steps.slice(closingAt + 1);
        const closingTime = closing.reduce((t, s) => t + this.medEstimate(s), 0);
        const timeLeft = () => total - this.medElapsed() - closingTime;

        const recorded = voiceOn && this.medUsesRecordings();
        if (recorded) {
            // Load the session's lines one by one, in the order they're spoken (breath cues
            // after the first few), rather than all at once
            const says = steps.filter(st => st.say).map(st => st.say);
            const cues = Object.values(BREATH_PATTERNS).flat().map(p => p.cue).filter(Boolean);
            const order = [...new Set([...says.slice(0, 3), ...cues, ...says.slice(3)])];
            (async () => {
                for (const line of order) {
                    if (m.cancelled || !m.running) break;
                    await this.medClip(line);
                }
            })();
        }
        // A device voice must start inside the tap (iOS rule), so speak its first line now
        if (!recorded && window.speechSynthesis?.speaking) speechSynthesis.cancel();
        const opening = !recorded && main[0]?.say ? this.medRunStep(main.shift()) : null;
        if (voiceOn && (recorded || window.speechSynthesis)) {
            setTimeout(() => {
                if (m.running && !m.cancelled && !m.heardVoice && !m.voiceProblem) hint.hidden = false;
            }, 5000 / (this._medTimeScale || 1));
        }
        // Keep the screen on, but never wait for it (it can hang in Home Screen apps)
        try {
            navigator.wakeLock?.request('screen').then(lock => {
                if (m.running) m.wakeLock = lock; else lock.release().catch(() => {});
            }).catch(() => {});
        } catch (e) { /* not supported */ }
        if (opening) await opening;
        else await this.medSleep(1.2); // let the opening chime ring

        for (const step of main) {
            if (m.cancelled) break;
            if (step.fill) await this.medBreathe(step, timeLeft());
            else if (this.medEstimate(step) <= timeLeft() + 1) await this.medRunStep(step);
        }
        // Quiet breathing for any time left before the ending
        if (!m.cancelled && timeLeft() > 3) await this.medBreathe({ breathe: 'easy' }, timeLeft());
        for (const step of closing) {
            if (m.cancelled) break;
            await this.medRunStep(step);
        }
        if (!m.cancelled && total - this.medElapsed() > 0.5) await this.medSleep(total - this.medElapsed());
        this.finishMeditation(!m.cancelled || this.medElapsed() >= total * 0.9);
    }

    medPause() {
        const m = this._med;
        if (!m?.running || m.paused) return;
        m.accumulated += performance.now() - m.resumedAt;
        m.paused = true;
        m.tick?.();
        this.medStopVoice();
        this.medReleaseAudio();
        document.getElementById('medPauseBtn').textContent = 'Resume';
        document.getElementById('medPhase').textContent = 'Paused';
    }

    medResume() {
        const m = this._med;
        if (!m?.running || !m.paused) return;
        m.resumedAt = performance.now();
        m.paused = false;
        this.medPrimeAudio(); // Resume is a tap, so audio can restart
        if (m.voiceProblem?.startsWith('The iPhone paused')) {
            this.medAudioReady().then(state => {
                if (state === 'running' && m.voiceProblem?.startsWith('The iPhone paused')) {
                    m.voiceProblem = null;
                    document.getElementById('medHint').hidden = true;
                }
            });
        }
        // Pick up the recorded line where it stopped
        if (m.line && m.voiceOn) {
            const offset = this.medElapsed() - m.line.startedAt;
            if (offset < m.line.buffer.duration - 0.2) m.source = this.medPlayBuffer(m.line.buffer, offset);
        }
        document.getElementById('medPauseBtn').textContent = 'Pause';
        document.getElementById('medPhase').textContent = '';
    }

    medStop() {
        const m = this._med;
        if (!m?.running) return this.closeMedPlayer();
        if (m.paused) this.medResume();
        m.cancelled = true;
        this.medStopVoice();
    }

    // Log the session; 3+ minute sessions check off the Meditate goal for today
    finishMeditation(completed) {
        const m = this._med;
        if (!m || !m.running) return;
        m.running = false;
        m.endedAt = this.medElapsed();
        clearInterval(m.ticker);
        m.wakeLock?.release?.().catch(() => {});
        this.medStopVoice();
        if (!completed) return this.closeMedPlayer();

        const session = MEDITATIONS[m.kind];
        this.medChime(session.gentle);
        setTimeout(() => { if (!this._med?.running) this.medReleaseAudio(); }, 3500); // after the chime
        const now = new Date();
        const day = this.reflectionDay(now);
        (this.data.meditationLog ||= []).push({ date: this.localDateKey(day), ts: now.toISOString(), kind: m.kind, minutes: m.minutes, ...(m.theme && { theme: m.theme.id }) });

        let note = m.minutes >= 3 ? '' : 'Short sessions are logged but don’t check off Meditate (your goal is 3–5 minutes).';
        if (m.minutes >= 3 && this.checkOffGoal(/meditat/i, day)) note = `Meditate is checked off for ${this.reflectionDayName(now)} ✓`;
        this.saveData();
        this.logActivity(`Meditated: ${session.title}, ${m.minutes} min`);

        document.getElementById('medStage').hidden = true;
        document.getElementById('medControls').hidden = true;
        document.getElementById('medDone').hidden = false;
        document.getElementById('medDoneDetail').textContent = `${session.title} · ${m.minutes} min. ${note}`;
        document.getElementById('medRemaining').textContent = '0:00';
    }

    closeMedPlayer() {
        this.medReleaseAudio();
        document.getElementById('medPlayer').hidden = true;
        document.body.classList.remove('med-open');
        this.renderMeditation();
        this.renderHabits();
        this.renderHealth();
    }

    // ========================================
    // Weekly Review Section
    // ========================================
    bindReview() {
        document.getElementById('saveReviewBtn').addEventListener('click', () => this.saveWeeklyReview());

        // Rating buttons
        document.getElementById('weekRating').addEventListener('click', (e) => {
            if (e.target.classList.contains('rating-btn')) {
                document.querySelectorAll('#weekRating .rating-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    renderReview() {
        const week = this.getCurrentWeek();
        if (week) {
            document.getElementById('reviewWeekDate').textContent = this.formatWeekDate(week.startDate);
        }

        // Strike summary
        this.renderStrikeSummary();

        // Review scores from current week
        this.renderReviewScores();
        this.renderPastReviews();
    }

    generateStrikeSummary(week) {
        if (!week) return null;

        // Collect strikes per goal (key by entry index since goals have no id)
        const strikeList = [];
        Object.values(week.entries).forEach(entry => {
            const strikes = this.scoreEntry(week, entry).misses;
            if (strikes > 0) {
                strikeList.push({
                    name: entry.goal.name,
                    category: entry.goal.category,
                    count: strikes
                });
            }
        });
        strikeList.sort((a, b) => b.count - a.count);

        if (strikeList.length === 0) return null;

        const totalStrikes = strikeList.reduce((s, g) => s + g.count, 0);

        // Group by category
        const catStrikes = {};
        strikeList.forEach(g => {
            if (!catStrikes[g.category]) catStrikes[g.category] = { count: 0, goals: [] };
            catStrikes[g.category].count += g.count;
            catStrikes[g.category].goals.push(g.name);
        });

        // Pick top categories
        const topCats = Object.entries(catStrikes)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 2);

        // Build sentence
        let summary = '';
        if (strikeList.length === 0) {
            summary = 'Clean week — no strikes recorded.';
        } else if (strikeList.length === 1) {
            const g = strikeList[0];
            summary = `This week's only strike was ${g.name} (${g.count}x). One thing to tighten up next week.`;
        } else {
            const parts = topCats.map(([cat, data]) => {
                const topGoal = data.goals[0];
                return data.goals.length > 1
                    ? `${cat} (${data.count} strikes including ${topGoal})`
                    : `${topGoal} in ${cat} (${data.count}x)`;
            });

            summary = `This week's biggest struggles: ${parts.join(' and ')}.`;
            if (totalStrikes > 3) {
                summary += ` ${totalStrikes} total strikes — focus here heading into next week.`;
            } else {
                summary += ` Small gaps — easy to close next week.`;
            }
        }

        return { summary, totalStrikes, topGoals: strikeList.slice(0, 3) };
    }

    renderStrikeSummary() {
        const card = document.getElementById('strikeSummaryCard');
        const textEl = document.getElementById('strikeSummaryText');
        if (!card || !textEl) return;

        // Use the same week that the review scores show (the currently viewed week)
        const targetWeek = this.getCurrentWeek();
        if (!targetWeek) {
            card.style.display = 'none';
            return;
        }

        const result = this.generateStrikeSummary(targetWeek);
        const hasData = Object.values(targetWeek.entries).some(e => e.tracking.some(v => v !== ''));
        if (!hasData && !result) {
            card.style.display = 'none';
            return;
        }

        const lastWeekDate = this.startOfToday();
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        const weekLabel = targetWeek === this.getWeekForDate(new Date()) ? 'This week'
            : targetWeek === this.getWeekForDate(lastWeekDate) ? 'Last week' : 'That week';

        if (!result) {
            card.style.display = 'flex';
            card.classList.add('strike-summary-clean');
            textEl.textContent = `${weekLabel}: no strikes — clean week!`;
            return;
        }

        card.style.display = 'flex';
        card.classList.remove('strike-summary-clean');
        const baseSummary = result.summary.replace(/^This week/, weekLabel);
        textEl.innerHTML = `<strong>${result.totalStrikes} strike${result.totalStrikes === 1 ? '' : 's'}</strong> · ${this.escapeHtml(baseSummary)}`;
    }

    renderReviewScores() {
        const container = document.getElementById('reviewScores');
        const week = this.getCurrentWeek();
        if (!week) {
            container.innerHTML = '';
            return;
        }

        const catStats = this.scoreByCategory(week);

        container.innerHTML = Object.entries(catStats).map(([cat, s]) => {
            const pct = this.scorePct(s);
            return `<div class="review-score-card">
                <div class="score-value">${pct}%</div>
                <div class="score-label">${cat}</div>
            </div>`;
        }).join('');
    }

    saveWeeklyReview() {
        const wins = document.getElementById('reviewWins').value.trim();
        const improvements = document.getElementById('reviewImprovements').value.trim();
        const p1 = document.getElementById('reviewPriority1').value.trim();
        const p2 = document.getElementById('reviewPriority2').value.trim();
        const p3 = document.getElementById('reviewPriority3').value.trim();
        const ratingBtn = document.querySelector('#weekRating .rating-btn.active');
        const rating = ratingBtn ? parseInt(ratingBtn.dataset.rating) : null;

        if (!wins && !improvements) {
            alert('Please fill in at least one field.');
            return;
        }

        const week = this.getCurrentWeek();
        const review = {
            weekDate: week ? this.formatWeekDate(week.startDate) : this.getTodayStr(),
            timestamp: new Date().toISOString(),
            wins,
            improvements,
            priorities: [p1, p2, p3].filter(Boolean),
            rating
        };

        this.data.weeklyReviews.unshift(review);
        this.saveData();
        this.logActivity('Completed weekly review' + (rating ? ` (rated ${rating}/10)` : ''));

        // Clear form
        document.getElementById('reviewWins').value = '';
        document.getElementById('reviewImprovements').value = '';
        document.getElementById('reviewPriority1').value = '';
        document.getElementById('reviewPriority2').value = '';
        document.getElementById('reviewPriority3').value = '';
        document.querySelectorAll('#weekRating .rating-btn').forEach(b => b.classList.remove('active'));

        this.renderReview();
        alert('Weekly review saved!');
    }

    renderPastReviews() {
        const container = document.getElementById('pastReviewsList');

        if (this.data.weeklyReviews.length === 0) {
            container.innerHTML = '<div class="empty-state">Complete your first weekly review to see history here.</div>';
            return;
        }

        container.innerHTML = this.data.weeklyReviews.slice(0, 10).map(r => `
            <div class="review-history-card">
                <div class="review-history-header">
                    <span class="review-history-date">${r.weekDate}</span>
                    ${r.rating ? `<span class="review-history-rating">${r.rating}/10</span>` : ''}
                </div>
                <div class="review-history-content">
                    ${r.wins ? `<p><strong>Wins:</strong> ${this.escapeHtml(r.wins)}</p>` : ''}
                    ${r.improvements ? `<p><strong>Improve:</strong> ${this.escapeHtml(r.improvements)}</p>` : ''}
                    ${r.priorities?.length ? `<p><strong>Priorities:</strong> ${r.priorities.map(p => this.escapeHtml(p)).join(', ')}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    // ========================================
    // Forms
    // ========================================
    bindForms() {
        // Add Goal
        document.getElementById('addGoalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const cat = document.getElementById('goalCategory').value;
            const name = document.getElementById('goalName').value.trim();
            const target = document.getElementById('goalTarget').value.trim();

            if (!name) return;

            this.data.goals.push({ category: cat, name, target });

            // Add to current week
            const week = this.getCurrentWeek();
            if (week) {
                const idx = Object.keys(week.entries).length;
                week.entries[idx] = {
                    goal: { category: cat, name, target },
                    tracking: ['', '', '', '', '', '', '']
                };
            }

            this.saveData();
            this.logActivity(`Added goal: ${name}`);
            this.closeModal('addGoalModal');
            document.getElementById('addGoalForm').reset();
            this.renderGoals();
        });

    }

    // ========================================
    // Quick Actions
    // ========================================
    bindQuickActions() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                switch (action) {
                    case 'log-habit':
                        this.navigateTo('habits');
                        break;
                    case 'journal-entry':
                        this.navigateTo('journal');
                        break;
                    case 'weekly-review':
                        this.navigateTo('review');
                        break;
                }
            });
        });
    }

    // ========================================
    // Settings
    // ========================================
    bindSettings() {
        document.getElementById('syncBannerBtn').addEventListener('click', () => {
            this.openModal('settingsModal');
            this.updateConvexStatusUI();
            this.renderReminderSettings();
            document.getElementById('convexKeyInput').focus();
        });

        ['settingsBtn', 'mobileSettingsBtn'].forEach(id => {
            document.getElementById(id).addEventListener('click', () => {
                this.openModal('settingsModal');
                this.updateConvexStatusUI();
                this.renderReminderSettings();
            });
        });

        // Reminders — times and timezone live in data.settings.reminders, which the Convex cron reads
        ['reminderMorning', 'reminderEvening', 'reminderTimezone'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.saveReminderSettings(this.readReminderInputs());
                this.renderReminderStatus();
            });
        });
        document.getElementById('enableRemindersBtn').addEventListener('click', () => this.toggleReminders());
        document.getElementById('testReminderBtn').addEventListener('click', () => this.sendTestReminder());

        // Convex connection
        document.getElementById('connectConvexBtn').addEventListener('click', async () => {
            const url = document.getElementById('convexUrlInput').value.trim();
            const appKey = document.getElementById('convexKeyInput').value.trim();
            if (!url) { alert('Please enter a Convex deployment URL'); return; }
            localStorage.setItem('lifeOS_convexUrl', url);
            localStorage.setItem('lifeOS_appKey', appKey);
            if (this.convex) this.convex.unsubscribe();
            this.convex = new ConvexDataLayer(url, appKey);
            this.updateConvexStatusUI();
            // Load remote first — only push if local has more data
            const remote = await this.convex.load();
            if (this.convex.unauthorized) {
                // Wrong key: don't touch the cloud copy; say so and stop here
                this.updateConvexStatusUI();
                return;
            }
            const remoteWeeks = (remote?.weeks || []).length;
            const localWeeks = (this.data.weeks || []).length;
            if (remote && remoteWeeks >= localWeeks) {
                this.data = this.normalizeData(remote);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                this.renderAll();
            } else {
                await this.convex.save(this.data);
            }
            this.convex.subscribe((payload) => {
                this.data = this.normalizeData(payload);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                this.renderAll();
            });
            this.logActivity('Connected to Convex — sync active');
        });

        document.getElementById('syncToConvexBtn').addEventListener('click', async () => {
            if (!this.convex || !this.convex.isConnected()) {
                alert('Not connected to Convex. Save your URL first.');
                return;
            }
            const btn = document.getElementById('syncToConvexBtn');
            btn.textContent = 'Pushing...';
            btn.disabled = true;
            await this.convex.save(this.data);
            btn.textContent = 'Pushed ✓';
            btn.disabled = false;
            setTimeout(() => { btn.textContent = 'Push to Convex'; }, 2000);
            this.logActivity('Manually pushed data to Convex');
        });

        document.getElementById('pullFromConvexBtn').addEventListener('click', async () => {
            if (!this.convex || !this.convex.isConnected()) {
                alert('Not connected to Convex. Save your URL first.');
                return;
            }
            const btn = document.getElementById('pullFromConvexBtn');
            btn.textContent = 'Pulling...';
            btn.disabled = true;
            const remote = await this.convex.load();
            if (remote) {
                this.data = this.normalizeData(remote);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                this.renderAll();
                btn.textContent = 'Pulled ✓';
                this.logActivity('Manually pulled data from Convex');
            } else {
                btn.textContent = 'Nothing found';
            }
            btn.disabled = false;
            setTimeout(() => { btn.textContent = 'Pull from Convex'; }, 2000);
        });

        document.getElementById('mergeHistoricalBtn').addEventListener('click', () => {
            document.getElementById('mergeHistoricalInput').click();
        });
        document.getElementById('mergeHistoricalInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.mergeHistoricalJSON(file);
        });

        document.getElementById('importSheetsBtn').addEventListener('click', () => {
            document.getElementById('sheetsFileInput').click();
        });
        document.getElementById('sheetsFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.importGoogleSheetsCSV(file);
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `life-os-backup-${this.getTodayStr()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('importAllBtn').addEventListener('click', () => {
            document.getElementById('importJsonInput').click();
        });

        document.getElementById('importJsonInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    this.data = this.normalizeData(imported);
                    this.saveData();
                    this.logActivity('Restored from backup');
                    location.reload();
                } catch (err) {
                    alert('Error importing: ' + err.message);
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('dedupWeeksBtn').addEventListener('click', () => {
            const before = this.data.weeks.length;
            // Group weeks by their Sunday date key; keep the one with more tracked cells
            const byKey = {};
            this.data.weeks.forEach(w => {
                const key = this.weekKey(new Date(w.startDate));
                if (!byKey[key]) { byKey[key] = w; return; }
                // Count non-empty tracking cells for each candidate
                const countCells = week => Object.values(week.entries)
                    .reduce((n, e) => n + e.tracking.filter(v => v !== '').length, 0);
                if (countCells(w) > countCells(byKey[key])) byKey[key] = w;
            });
            this.data.weeks = Object.values(byKey)
                .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const removed = before - this.data.weeks.length;
            this.saveData();
            if (removed > 0) {
                alert(`Removed ${removed} duplicate week${removed > 1 ? 's' : ''}. Page will reload.`);
                location.reload();
            } else {
                alert('No duplicate weeks found — your data is clean!');
            }
        });

        document.getElementById('resetAllBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset ALL Life OS data? This cannot be undone.')) {
                if (confirm('This will delete everything. Last chance - are you sure?')) {
                    localStorage.removeItem(this.STORAGE_KEY);
                    location.reload();
                }
            }
        });
    }

    // ========================================
    // Reminders (Web Push via Convex)
    // ========================================
    getReminderSettings() {
        const r = { ...DEFAULT_REMINDERS, ...(this.data.settings.reminders || {}) };
        if (!r.timezone) r.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
        return r;
    }

    saveReminderSettings(patch) {
        this.data.settings.reminders = { ...this.getReminderSettings(), ...patch };
        this.saveData();
    }

    readReminderInputs() {
        return {
            morning: document.getElementById('reminderMorning').value || DEFAULT_REMINDERS.morning,
            evening: document.getElementById('reminderEvening').value || DEFAULT_REMINDERS.evening,
            timezone: document.getElementById('reminderTimezone').value
        };
    }

    renderReminderSettings() {
        const r = this.getReminderSettings();
        document.getElementById('reminderMorning').value = r.morning;
        document.getElementById('reminderEvening').value = r.evening;
        const tzSelect = document.getElementById('reminderTimezone');
        let zones = [];
        try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { /* older browsers */ }
        if (!zones.includes(r.timezone)) zones = [r.timezone, ...zones];
        tzSelect.innerHTML = zones.map(z => `<option value="${z}">${z.replace(/_/g, ' ')}</option>`).join('');
        tzSelect.value = r.timezone;
        this.renderReminderStatus();
        // Fetch the VAPID key now so nothing is awaited before the permission prompt on tap
        if (this.convex && !this._vapidKeyPromise) this.prefetchVapidKey();
    }

    prefetchVapidKey() {
        this._vapidKeyPromise = this.convex.query('push:getVapidPublicKey').then(key => {
            if (!key) throw new Error('reminders are not set up on the Convex backend yet');
            return key;
        });
        this._vapidKeyPromise.catch(() => { this._vapidKeyPromise = null; });
        return this._vapidKeyPromise;
    }

    async getPushSubscription() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
        const reg = await navigator.serviceWorker.getRegistration();
        return reg ? reg.pushManager.getSubscription() : null;
    }

    setReminderStatus(text, tone) {
        const el = document.getElementById('reminderStatus');
        el.textContent = text;
        el.style.color = tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--text-muted)';
    }

    formatTime12(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    }

    async renderReminderStatus() {
        const r = this.getReminderSettings();
        let sub = null;
        try { sub = await this.getPushSubscription(); } catch (e) { /* unsupported */ }
        this._pushSubscribed = !!sub;
        const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        const on = r.enabled && !!sub && granted;
        const btn = document.getElementById('enableRemindersBtn');
        btn.textContent = on ? 'Turn off reminders' : 'Enable reminders';
        btn.className = `btn ${on ? 'btn-secondary' : 'btn-primary'}`;
        document.getElementById('testReminderBtn').style.display = on ? 'inline-block' : 'none';
        if (on) {
            this.setReminderStatus(`🔔 On for this device — ${this.formatTime12(r.morning)} nudge, ${this.formatTime12(r.evening)} "items left" (${r.timezone.replace(/_/g, ' ')}).`, 'ok');
        } else if (r.enabled) {
            this.setReminderStatus('Reminders are on, but not for this device. Tap Enable reminders to add it.');
        } else {
            this.setReminderStatus('Off.');
        }
    }

    // Enable (or turn off) push reminders for this device. Called straight from the tap.
    async toggleReminders() {
        if (this.getReminderSettings().enabled && this._pushSubscribed) return this.disableReminders();

        if (!this.convex) {
            this.setReminderStatus('Connect Convex above first — reminders are sent from your Convex backend.', 'warn');
            return;
        }
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
            this.setReminderStatus('This browser can\'t receive push. On iPhone: Safari → Share → Add to Home Screen, then open Life OS from the Home Screen icon (iOS 16.4+) and tap again.', 'warn');
            return;
        }
        // Must be the first await: iOS only shows the prompt in direct response to a tap
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            this.setReminderStatus('Notifications are blocked. Allow them in iPhone Settings → Notifications → Life OS, then tap again.', 'warn');
            return;
        }

        const btn = document.getElementById('enableRemindersBtn');
        btn.disabled = true;
        this.setReminderStatus('Subscribing…');
        try {
            const key = await (this._vapidKeyPromise || this.prefetchVapidKey());
            const reg = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => setTimeout(() => reject(new Error('service worker not active — reload the app and try again')), 10000))
            ]);
            const appKey = this.base64UrlToBytes(key);
            let sub = await reg.pushManager.getSubscription();
            if (sub && !this.sameBytes(sub.options?.applicationServerKey, appKey)) {
                await sub.unsubscribe(); // subscribed under an old key
                sub = null;
            }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
            const json = sub.toJSON();
            await this.convex.mutation('push:saveSubscription', {
                subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
                userAgent: navigator.userAgent.slice(0, 200)
            });
            this.saveReminderSettings({ ...this.readReminderInputs(), enabled: true });
            this.logActivity('Turned on reminders');
            this.updateAppBadge();
        } catch (err) {
            this.setReminderStatus('Could not enable reminders: ' + err.message, 'warn');
            btn.disabled = false;
            return;
        }
        btn.disabled = false;
        this.renderReminderStatus();
    }

    async disableReminders() {
        this.saveReminderSettings({ enabled: false });
        try {
            const sub = await this.getPushSubscription();
            if (sub) {
                if (this.convex) await this.convex.mutation('push:removeSubscription', { endpoint: sub.endpoint }).catch(() => {});
                await sub.unsubscribe();
            }
        } catch (e) { /* already gone */ }
        this.logActivity('Turned off reminders');
        this.renderReminderStatus();
    }

    async sendTestReminder() {
        const btn = document.getElementById('testReminderBtn');
        btn.disabled = true;
        try {
            const res = await this.convex.action('pushNode:sendTest', { timezone: this.getReminderSettings().timezone });
            this.setReminderStatus(`Test sent to ${res.sent} device${res.sent === 1 ? '' : 's'}${res.failed ? ` (${res.failed} failed)` : ''}.`, res.sent ? 'ok' : 'warn');
        } catch (err) {
            this.setReminderStatus('Test failed: ' + err.message, 'warn');
        }
        btn.disabled = false;
    }

    base64UrlToBytes(b64url) {
        const b64 = (b64url + '='.repeat((4 - b64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }

    sameBytes(buf, bytes) {
        if (!buf) return true; // browser doesn't expose the key — assume it matches
        const a = new Uint8Array(buf);
        return a.length === bytes.length && a.every((x, i) => x === bytes[i]);
    }

    updateConvexStatusUI() {
        const statusEl = document.getElementById('convexStatus');
        const syncBtn = document.getElementById('syncToConvexBtn');
        const urlInput = document.getElementById('convexUrlInput');
        const savedUrl = localStorage.getItem('lifeOS_convexUrl');

        if (savedUrl) urlInput.value = savedUrl;
        const keyInput = document.getElementById('convexKeyInput');
        if (document.activeElement !== keyInput) keyInput.value = localStorage.getItem('lifeOS_appKey') || '';
        document.getElementById('syncBanner').hidden = !this.convex?.unauthorized;

        const pullBtn = document.getElementById('pullFromConvexBtn');
        if (this.convex?.unauthorized) {
            statusEl.textContent = 'Sync paused: the app key is missing or wrong. Paste it above and tap Connect.';
            statusEl.style.color = 'var(--danger)';
            syncBtn.style.display = 'none';
            pullBtn.style.display = 'none';
        } else if (this.convex && this.convex.isConnected()) {
            statusEl.textContent = '🟢 Syncing across devices';
            statusEl.style.color = 'var(--success)';
            syncBtn.style.display = 'inline-block';
            pullBtn.style.display = 'inline-block';
        } else if (savedUrl) {
            statusEl.textContent = '🟡 Connecting…';
            statusEl.style.color = 'var(--warning)';
            syncBtn.style.display = 'none';
            pullBtn.style.display = 'none';
        } else {
            statusEl.textContent = '⚪ Local only — enter a Convex URL to sync';
            statusEl.style.color = 'var(--text-muted)';
            syncBtn.style.display = 'none';
            pullBtn.style.display = 'none';
        }
    }

    // ========================================
    // Utilities
    // ========================================
    // ========================================
    // Google Sheets CSV Import
    // ========================================
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
                else if (ch === '"') inQuotes = false;
                else current += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { result.push(current); current = ''; }
                else current += ch;
            }
        }
        result.push(current);
        return result;
    }

    mergeHistoricalJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                const historicalWeeks = imported.weeks || [];
                if (!historicalWeeks.length) {
                    alert('No weeks found in the JSON file.');
                    return;
                }

                // Build a map keyed by the Sunday date (YYYY-MM-DD) — ignores time zone differences
                const existingMap = {};
                (this.data.weeks || []).forEach(w => {
                    existingMap[this.weekKey(new Date(w.startDate))] = w;
                });

                let added = 0, skipped = 0;
                historicalWeeks.forEach(hw => {
                    const key = this.weekKey(new Date(hw.startDate));
                    if (existingMap[key]) {
                        // Week already exists — skip (don't overwrite user's current data)
                        skipped++;
                    } else {
                        existingMap[key] = hw;
                        added++;
                    }
                });

                // Sort weeks by date and save
                this.data.weeks = Object.values(existingMap)
                    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                this.saveData();
                this.logActivity(`Merged ${added} historical weeks (${skipped} already existed)`);
                alert(`Import complete!\n✅ ${added} weeks added\n⏭ ${skipped} weeks already existed (not overwritten)\n\nPage will reload to apply changes.`);
                location.reload();
            } catch (err) {
                alert('Error reading file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    importGoogleSheetsCSV(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let csv = e.target.result;
                if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);
                const lines = csv.split(/\r?\n/);

                const importedWeeks = [];
                let currentWeek = null;
                let currentCategory = null;
                let currentYear = null;
                let lastMonth = null;

                const knownCats = ['physical health', 'mental health', 'budgeting', 'work',
                    'cooking', 'monthly', 'other', 'morning protocol', 'midday protocol',
                    'evening protocol'];
                const skipPatterns = ['grand total', 'total strikes', 'week specific',
                    'misses:', 'keep strike', 'this week'];
                const dayLabels = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

                const inferYear = (month) => {
                    if (!currentYear) {
                        return month >= 9 ? 2024 : 2025;
                    }
                    if (lastMonth && lastMonth > month + 2) return currentYear + 1;
                    return currentYear;
                };

                const startWeek = (monthDayStr) => {
                    const [m, d] = monthDayStr.split('/').map(Number);
                    if (isNaN(m) || isNaN(d)) return;
                    currentYear = inferYear(m);
                    lastMonth = m;
                    if (currentWeek && Object.keys(currentWeek.entries).length > 0) {
                        importedWeeks.push(currentWeek);
                    }
                    const startStr = `${currentYear}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    currentWeek = { startDate: new Date(startStr + 'T12:00:00').toISOString(), entries: {}, source: 'imported' };
                    currentCategory = null;
                };

                for (const rawLine of lines) {
                    const cells = this.parseCSVLine(rawLine);
                    if (cells.length < 2) continue;

                    const c0 = (cells[0] || '').trim();
                    const c1 = (cells[1] || '').trim();
                    const c2 = (cells[2] || '').trim();
                    const lc0 = c0.toLowerCase();
                    const lc1 = c1.toLowerCase();

                    // Skip noise rows
                    if (skipPatterns.some(p => lc0.startsWith(p) || lc1.startsWith(p))) continue;
                    if (dayLabels.includes(c2.toLowerCase())) continue;

                    // FORMAT 1: ,,MM/DD,MM/DD,... (dates in cols 2+, c0 and c1 empty)
                    if (c0 === '' && c1 === '' && /^\d{1,2}\/\d{1,2}$/.test(c2)) {
                        startWeek(c2);
                        continue;
                    }

                    // FORMAT 2: MM/DD-MM/DD,,,... (date range in col 0)
                    if (/^\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}$/.test(c0)) {
                        startWeek(c0.split('-')[0]);
                        continue;
                    }

                    if (!currentWeek || !c1) continue;

                    // Category row detection
                    const tracking7 = cells.slice(2, 9);
                    const hasTracking = tracking7.some(v => (v || '').trim() === 'X' || (v || '').trim() === 'x' || (v || '').trim() === '1');

                    if (knownCats.includes(lc1) || (!hasTracking && c1.length < 45)) {
                        currentCategory = c1;
                        continue;
                    }

                    // Goal row — extract tracking from cols 2-8
                    const tracking = tracking7.map(v => {
                        const t = (v || '').trim();
                        if (t === 'X' || t === 'x') return 'X';
                        if (t === '1') return '1';
                        return '';
                    });
                    while (tracking.length < 7) tracking.push('');

                    const idx = Object.keys(currentWeek.entries).length;
                    currentWeek.entries[idx] = {
                        goal: { name: c1, category: currentCategory || 'Other', target: '' },
                        tracking
                    };
                }

                if (currentWeek && Object.keys(currentWeek.entries).length > 0) {
                    importedWeeks.push(currentWeek);
                }

                if (importedWeeks.length === 0) {
                    alert('No weeks found. Make sure this is a Google Sheets CSV export from your accountability tracker.');
                    return;
                }

                let added = 0;
                for (const week of importedWeeks) {
                    const exists = this.data.weeks.some(w =>
                        new Date(w.startDate).toDateString() === new Date(week.startDate).toDateString()
                    );
                    if (!exists) { this.data.weeks.push(week); added++; }
                }

                this.data.weeks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                this.saveData();
                this.logActivity(`Imported ${added} historical weeks from Google Sheets`);
                this.renderDashboard();
                this.closeModal('settingsModal');
                alert(`Imported ${added} historical weeks from Google Sheets!\n\n` +
                    `Your all-time stats now appear on the Dashboard.\n` +
                    `Use Previous/Next in the Goals tab to browse past weeks.`);
            } catch (err) {
                alert('Error parsing CSV: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // Local date: toISOString() is UTC, which is already tomorrow on a US evening
    getTodayStr() {
        return this.localDateKey(new Date());
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // For attribute values: escapeHtml leaves quotes alone
    escapeAttr(str) {
        return this.escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
        return Math.floor(seconds / 86400) + 'd ago';
    }
}

// ========================================
// Initialize
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    window.lifeOS = new LifeOS();
});
