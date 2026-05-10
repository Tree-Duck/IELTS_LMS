/* ─── State ──────────────────────────────────────────────────────────────── */
let token = localStorage.getItem('ielts_token');
let currentUser = JSON.parse(localStorage.getItem('ielts_user') || 'null');
let pollingInterval = null;
let selectedTopic = 'random';
let activeChart = null;       // Chart.js instance
let promptUserTyped = false;  // tracks manual paste/type in prompt
let pendingVerifyEmail = null; // email awaiting verification
let pendingResetEmail = null;  // email awaiting password reset

// Paste detection state — reset each time the submit view is opened
let pasteStats = { paste_count: 0, total_pasted: 0, total_typed: 0, largest_paste: 0 };

// Writing Timer state
let writingTimerSecs = 0;
let writingTimerInterval = null;
let writingTimerRunning = false;

// Flashcard state
let flashcards = [];
let flashcardIndex = 0;

// Draft auto-save
const DRAFT_KEY = 'ielts_essay_draft';

// Attendance state
let currentClassId = null;
let classCalendar = null;
let myAttendanceCalendar = null;
let currentAttendanceSessionId = null;

const TOPIC_OPTIONS = {
  task2: [
    { value: 'random',        label: '🎲 Random' },
    { value: 'Technology',    label: '💻 Technology' },
    { value: 'Environment',   label: '🌿 Environment' },
    { value: 'Education',     label: '🎓 Education' },
    { value: 'Health',        label: '🏥 Health' },
    { value: 'Society',       label: '🏙️ Society' },
    { value: 'Work & Career', label: '💼 Work & Career' },
    { value: 'Crime & Law',   label: '⚖️ Crime & Law' },
  ],
  task1: [
    { value: 'random',           label: '🎲 Random' },
    { value: 'bar_chart',        label: '📊 Bar Chart' },
    { value: 'line_graph',       label: '📈 Line Graph' },
    { value: 'pie_chart',        label: '🥧 Pie Chart' },
    { value: 'table',            label: '📋 Table' },
    { value: 'process_diagram',  label: '⚙️ Process Diagram' },
    { value: 'map',              label: '🗺️ Map' },
  ],
};

/* ─── IELTS Prompt Bank ──────────────────────────────────────────────────── */
const PROMPT_BANK = {
  task1: [
    // Easy — standard bar/pie/line charts with straightforward data
    { difficulty: 'easy', q: 'The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The graph below shows the number of university graduates in Canada from 1992 to 2007. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The pie charts below show the main sources of energy in a European country in 1985 and 2015. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The bar chart below shows the average number of hours per week that people in five different countries spend on leisure activities. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The line graph below shows the changing birth and death rates in New Zealand between 1901 and 2001. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The bar chart below shows the percentage of students at three different types of schools who said they enjoyed reading in 2005 and 2015. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The line graph below shows the average monthly temperatures in three cities over a twelve-month period. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The charts below show the percentage of food budget spent on different types of food in four countries. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The bar chart below shows the number of visitors to three London museums between 2004 and 2008. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The line graph below shows the number of books borrowed from four different libraries between 2014 and 2016. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'easy', q: 'The bar chart below compares the percentages of people in three countries who reported using the internet daily in 2005 and 2015. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    // Medium — maps, tables, multi-chart comparisons
    { difficulty: 'medium', q: 'The map below shows the changes that have taken place in the town of Eltington between 2000 and the present day. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The table below shows the sales of various products in an electronics store during four quarters of 2022. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The maps below show the development of a small fishing village called Oakton in 1985 and today. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The table below gives information about the underground railway systems in six cities. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The graph below shows the proportion of the population aged 65 and over between 1940 and 2040 in three different countries. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The two maps below show an island before and after the construction of some tourist facilities. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The chart below gives information about global spending on different categories from 1990 to 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The maps below show how the town of Bradfield has changed since the 1950s. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    { difficulty: 'medium', q: 'The two pie charts below show the proportion of carbon emissions produced by different sectors in a developed country in 1990 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' },
    // Hard — process/flow diagrams and complex life-cycle descriptions
    { difficulty: 'hard', q: 'The diagram below shows the process of producing electricity from coal. Summarise the information by selecting and reporting the main features.' },
    { difficulty: 'hard', q: 'The diagram illustrates the process by which cement is made and how it is then used to produce concrete for building purposes. Summarise the information by selecting and reporting the main features.' },
    { difficulty: 'hard', q: 'The diagram below shows the water cycle, which is the continuous movement of water on, above and below the surface of the Earth. Summarise the information by selecting and reporting the main features.' },
    { difficulty: 'hard', q: 'The diagram below shows how a solar panel works to provide hot water for domestic use. Summarise the information by selecting and reporting the main features.' },
    { difficulty: 'hard', q: 'The diagram below illustrates the stages in the life cycle of a silkworm. Summarise the information by selecting and reporting the main features.' },
  ],
  task2: [
    // Easy — direct opinion/agree-disagree on familiar topics
    { difficulty: 'easy', q: 'Some people believe that universities should only offer courses that are useful for employment. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', q: 'In many countries, the proportion of older people is steadily increasing. Do you think this is a positive or negative development? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', q: 'The increasing use of technology in the classroom is helping students learn more effectively. To what extent do you agree or disagree with this statement? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', q: 'Many people believe that social networking sites such as Facebook have had a huge negative impact on both individuals and society. To what extent do you agree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', q: 'The best way to reduce crime is to give longer prison sentences. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', q: 'Some countries spend large amounts of money on space exploration programmes. Do you think this money could be better spent? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', q: 'It is argued that getting a university education is the best way to guarantee a successful career. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'easy', q: 'Governments should spend money on railways rather than building new roads. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    // Medium — discuss both sides, causes/solutions, or advantages/disadvantages
    { difficulty: 'medium', q: 'Some people think that a sense of competition in children should be encouraged. Others believe that children who are taught to cooperate rather than compete become more useful adults. Discuss both these views and give your own opinion.' },
    { difficulty: 'medium', q: 'Some people say that advertising encourages us to buy things we do not really need. Others say that advertisements tell us about new products that may improve our lives. Discuss both views and give your own opinion.' },
    { difficulty: 'medium', q: 'In some countries, the government pays for university education. In other countries, students must pay for themselves. Discuss the advantages and disadvantages of government-funded university education.' },
    { difficulty: 'medium', q: 'Traffic congestion is becoming a huge problem in many cities around the world. What are the causes of this problem, and what measures could be taken to reduce it? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', q: 'Some people think that parents should teach children how to be good members of society. Others, however, believe that school is the place to learn this. Discuss both these views and give your own opinion.' },
    { difficulty: 'medium', q: 'In some parts of the world, traditional festivals and celebrations are disappearing. Why is this happening, and is it a positive or negative development? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', q: 'Many people prefer to watch foreign films rather than locally produced films. Why could this be? Should governments give more financial support to local film industries? Give reasons for your answer.' },
    { difficulty: 'medium', q: 'More and more people are choosing to live and work abroad. What are the reasons for this, and do the advantages outweigh the disadvantages? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', q: 'Some people feel that manufacturers and supermarkets have the responsibility to reduce the amount of packaging of goods. Others argue that it is the responsibility of consumers. Discuss both views and give your own opinion.' },
    { difficulty: 'medium', q: 'Some people think that the main purpose of schools is to turn children into good citizens and workers, rather than to benefit them as individuals. To what extent do you agree or disagree?' },
    { difficulty: 'medium', q: 'Many people are afraid that artificial intelligence will replace human workers in the near future. Do the advantages of AI outweigh the disadvantages? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', q: 'Children today spend less time playing outdoors and more time on screens. What are the reasons for this, and what are the consequences? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', q: 'Nowadays, people are living longer than ever before. What problems does this create and what solutions can you suggest? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'medium', q: 'The world is consuming far more natural resources than it did in the past. What are the reasons for this, and what can be done to stop it? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    // Hard — abstract, multi-layered, or nuanced arguments
    { difficulty: 'hard', q: 'Many governments think that economic progress is their most important goal. Some people, however, think that other types of progress are equally important for a country. Discuss both these views and give your own opinion.' },
    { difficulty: 'hard', q: 'The best way to solve the world\'s environmental problems is to increase the price of fuel. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'hard', q: 'Some people believe that it is better to accept a bad situation than to try to change it. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples.' },
  ]
};

/* ─── IELTS Speaking Bank ────────────────────────────────────────────────── */
const SPEAKING_BANK = {
  part1: [
    { cat: 'Work & Study', difficulty: 'easy', q: 'Do you work or are you a student?' },
    { cat: 'Work & Study', difficulty: 'easy', q: 'What subject do you enjoy most in your studies, and why?' },
    { cat: 'Work & Study', difficulty: 'medium', q: 'What are the most challenging aspects of your work or studies?' },
    { cat: 'Work & Study', difficulty: 'medium', q: 'Would you like to change your job or field of study in the future?' },
    { cat: 'Work & Study', difficulty: 'hard', q: 'How do you think your career will change over the next ten years?' },
    { cat: 'Hometown', difficulty: 'easy', q: 'Where are you from, and what is it like there?' },
    { cat: 'Hometown', difficulty: 'easy', q: 'What do you like most about your hometown?' },
    { cat: 'Hometown', difficulty: 'medium', q: 'Has your hometown changed much in recent years? How?' },
    { cat: 'Hometown', difficulty: 'medium', q: 'What changes would you like to see in your hometown?' },
    { cat: 'Hobbies', difficulty: 'easy', q: 'What do you like to do in your free time?' },
    { cat: 'Hobbies', difficulty: 'easy', q: 'Do you have any hobbies you have had since childhood?' },
    { cat: 'Hobbies', difficulty: 'medium', q: 'Is it important for people to have hobbies? Why or why not?' },
    { cat: 'Hobbies', difficulty: 'medium', q: 'Do you prefer indoor or outdoor activities? Why?' },
    { cat: 'Food & Cooking', difficulty: 'easy', q: 'What is your favourite food? Why do you like it?' },
    { cat: 'Food & Cooking', difficulty: 'easy', q: 'Do you prefer eating at home or at a restaurant?' },
    { cat: 'Food & Cooking', difficulty: 'medium', q: 'Has the food people eat in your country changed in recent years? How?' },
    { cat: 'Food & Cooking', difficulty: 'medium', q: 'Do you enjoy cooking? What do you like to cook?' },
    { cat: 'Technology', difficulty: 'easy', q: 'How often do you use the internet? What do you use it for?' },
    { cat: 'Technology', difficulty: 'medium', q: 'Do you think technology has made life easier or more complicated? Why?' },
    { cat: 'Technology', difficulty: 'medium', q: 'What was the most useful piece of technology you used today?' },
    { cat: 'Technology', difficulty: 'hard', q: 'Do you worry about how much personal information technology companies collect?' },
    { cat: 'Sport & Exercise', difficulty: 'easy', q: 'Do you do any sports or regular exercise?' },
    { cat: 'Sport & Exercise', difficulty: 'medium', q: 'Do you think young people today get enough exercise? Why?' },
    { cat: 'Sport & Exercise', difficulty: 'medium', q: 'Is watching sport as enjoyable as playing sport, in your opinion?' },
    { cat: 'Music & Arts', difficulty: 'easy', q: 'What type of music do you enjoy listening to?' },
    { cat: 'Music & Arts', difficulty: 'medium', q: 'Do you think learning to play a musical instrument is important for children?' },
    { cat: 'Music & Arts', difficulty: 'medium', q: 'Do you prefer to watch films at home or at the cinema?' },
    { cat: 'Travel', difficulty: 'easy', q: 'Do you enjoy travelling? Where have you been?' },
    { cat: 'Travel', difficulty: 'medium', q: 'What kind of places do you enjoy visiting the most, and why?' },
    { cat: 'Travel', difficulty: 'medium', q: 'Would you prefer to travel alone or with a group? Why?' },
    { cat: 'Friends & Family', difficulty: 'easy', q: 'How important is family to you?' },
    { cat: 'Friends & Family', difficulty: 'medium', q: 'Do you think it is harder to make friends as an adult than as a child?' },
    { cat: 'Friends & Family', difficulty: 'medium', q: 'How do you usually stay in touch with friends who live far away?' },
    { cat: 'Reading', difficulty: 'easy', q: 'Do you enjoy reading? What kinds of things do you read?' },
    { cat: 'Reading', difficulty: 'medium', q: 'Do you prefer reading physical books or using digital devices? Why?' },
    { cat: 'Shopping', difficulty: 'easy', q: 'Do you enjoy shopping? What kind of shopping do you like?' },
    { cat: 'Shopping', difficulty: 'medium', q: 'Do you think people buy things they do not really need? Why?' },
    { cat: 'Daily Routine', difficulty: 'easy', q: 'Can you describe your typical daily routine?' },
    { cat: 'Daily Routine', difficulty: 'medium', q: 'Would you like to change anything about your daily routine? Why?' },
    { cat: 'Weather', difficulty: 'easy', q: 'What kind of weather do you prefer, and why?' },
    { cat: 'Weather', difficulty: 'medium', q: 'How does the weather affect your mood or daily activities?' },
  ],
  part2: [
    { cat: 'People', difficulty: 'medium',
      card: 'Describe a person who has had a significant influence on your life.',
      bullets: ['Who this person is', 'How you know or knew this person', 'What they did that influenced you', 'And explain why you consider them an important influence'] },
    { cat: 'People', difficulty: 'medium',
      card: 'Describe someone you know who is very good at their job.',
      bullets: ['Who this person is', 'What their job is', 'Why you think they are good at it', 'And explain how you feel about this person'] },
    { cat: 'People', difficulty: 'hard',
      card: 'Describe a public figure you admire.',
      bullets: ['Who this person is', 'What they are famous for', 'What qualities you admire in them', 'And explain how this person has influenced society'] },
    { cat: 'Places', difficulty: 'easy',
      card: 'Describe a place you enjoy visiting in your free time.',
      bullets: ['Where the place is', 'How often you go there', 'What you do there', 'And explain why you enjoy visiting this place'] },
    { cat: 'Places', difficulty: 'medium',
      card: 'Describe a foreign country you would like to visit.',
      bullets: ['Which country you would like to visit', 'When you would like to go', 'What you would like to do there', 'And explain why you want to visit this country'] },
    { cat: 'Places', difficulty: 'medium',
      card: 'Describe a historical place you have visited or would like to visit.',
      bullets: ['Where this place is', 'What makes it historically significant', 'What you know about its history', 'And explain why you find it interesting'] },
    { cat: 'Places', difficulty: 'easy',
      card: 'Describe your ideal home.',
      bullets: ['Where it would be located', 'What it would look like', 'Who you would live there with', 'And explain why this would be your ideal home'] },
    { cat: 'Objects', difficulty: 'easy',
      card: 'Describe an object that is very important to you.',
      bullets: ['What the object is', 'How long you have had it', 'What you use it for', 'And explain why it is important to you'] },
    { cat: 'Objects', difficulty: 'medium',
      card: 'Describe a gift you recently gave or received.',
      bullets: ['What the gift was', 'Who gave or received it and why', 'How you felt about it', 'And explain why this gift was memorable'] },
    { cat: 'Objects', difficulty: 'hard',
      card: 'Describe a piece of technology that you find particularly useful.',
      bullets: ['What the technology is', 'How long you have been using it', 'How it has changed your daily life', 'And explain why you think it is valuable'] },
    { cat: 'Events', difficulty: 'medium',
      card: 'Describe a memorable event from your childhood.',
      bullets: ['What the event was', 'When it happened', 'Who was involved', 'And explain why this event has stayed in your memory'] },
    { cat: 'Events', difficulty: 'easy',
      card: 'Describe a celebration or festival that is important in your culture.',
      bullets: ['What the celebration or festival is', 'When it takes place', 'How people celebrate it', 'And explain why it is important to you or your culture'] },
    { cat: 'Events', difficulty: 'hard',
      card: 'Describe a time when you had to make a difficult decision.',
      bullets: ['What the decision was', 'When you had to make it', 'What factors you considered', 'And explain whether you feel the decision was the right one'] },
    { cat: 'Experiences', difficulty: 'easy',
      card: 'Describe a journey or trip that you really enjoyed.',
      bullets: ['Where you went', 'When the trip took place', 'Who you went with', 'And explain what made the journey enjoyable'] },
    { cat: 'Experiences', difficulty: 'medium',
      card: 'Describe a time you successfully learned something new.',
      bullets: ['What you learned', 'When and where you learned it', 'How you learned it', 'And explain how this new knowledge or skill has been useful to you'] },
    { cat: 'Experiences', difficulty: 'medium',
      card: 'Describe a skill that took you a long time to learn.',
      bullets: ['What the skill is', 'How long it took to learn', 'Who or what helped you', 'And explain how you feel about having this skill now'] },
    { cat: 'Experiences', difficulty: 'hard',
      card: 'Describe a challenge you faced and how you overcame it.',
      bullets: ['What the challenge was', 'When you faced it', 'What you did to deal with it', 'And explain what you learned from this experience'] },
    { cat: 'Media & Culture', difficulty: 'medium',
      card: 'Describe a book, film, or TV show that you enjoyed.',
      bullets: ['What it is and what it is about', 'When and how you came across it', 'Who you would recommend it to', 'And explain why you enjoyed it'] },
    { cat: 'Media & Culture', difficulty: 'medium',
      card: 'Describe a piece of news that you found particularly interesting.',
      bullets: ['What the news story was about', 'When you heard or read it', 'Where you got the information from', 'And explain why you found it interesting'] },
    { cat: 'Media & Culture', difficulty: 'easy',
      card: 'Describe a song that has special meaning to you.',
      bullets: ['What the song is', 'When you first heard it', 'Why it is meaningful to you', 'And explain what memories or feelings it brings back'] },
  ],
  part3: [
    { cat: 'Education', difficulty: 'medium', q: 'Do you think schools focus too much on academic results and not enough on personal development?' },
    { cat: 'Education', difficulty: 'hard', q: 'What are the advantages and disadvantages of online learning compared to traditional classroom education?' },
    { cat: 'Education', difficulty: 'hard', q: 'Should university education be free for everyone? Give reasons for your view.' },
    { cat: 'Education', difficulty: 'medium', q: 'Should children be taught about financial management in school? Why or why not?' },
    { cat: 'Technology', difficulty: 'easy', q: 'Do you think children spend too much time on electronic devices? What problems can this cause?' },
    { cat: 'Technology', difficulty: 'medium', q: 'How has social media changed the way people communicate with each other?' },
    { cat: 'Technology', difficulty: 'hard', q: 'Do you think artificial intelligence will create more jobs or lead to more unemployment? Why?' },
    { cat: 'Technology', difficulty: 'medium', q: 'Should governments regulate the internet more strictly? Why or why not?' },
    { cat: 'Environment', difficulty: 'easy', q: 'Do you think enough is being done to address climate change? Why or why not?' },
    { cat: 'Environment', difficulty: 'medium', q: 'What do you think are the most effective ways for individuals to help the environment?' },
    { cat: 'Environment', difficulty: 'hard', q: 'Do you believe economic development and environmental protection can go hand in hand? Why or why not?' },
    { cat: 'Society & Culture', difficulty: 'easy', q: 'How important is it for young people to preserve traditional culture?' },
    { cat: 'Society & Culture', difficulty: 'medium', q: 'How has the role of women in society changed over the past few decades?' },
    { cat: 'Society & Culture', difficulty: 'hard', q: 'Some people believe globalisation has had a negative impact on cultural diversity. Do you agree?' },
    { cat: 'Work & Economy', difficulty: 'medium', q: 'What qualities do you think are most important for success in the modern workplace?' },
    { cat: 'Work & Economy', difficulty: 'hard', q: 'Do you think the gap between rich and poor is getting wider? What can governments do about it?' },
    { cat: 'Work & Economy', difficulty: 'hard', q: 'Should people be encouraged to work from home permanently, or is office work better? Why?' },
    { cat: 'Health', difficulty: 'medium', q: 'Do you think governments should spend more on preventing illness or treating it? Why?' },
    { cat: 'Health', difficulty: 'hard', q: 'Some people believe mental health is just as important as physical health. Do you agree? Why?' },
    { cat: 'Health', difficulty: 'medium', q: 'How can society encourage people to lead healthier lifestyles?' },
    { cat: 'Society & Culture', difficulty: 'medium', q: 'Do you think people in your country have enough leisure time? Why or why not?' },
    { cat: 'Education', difficulty: 'medium', q: 'How important is it for students to learn languages other than their mother tongue? Why?' },
    { cat: 'Technology', difficulty: 'hard', q: 'How might technology change the way people work over the next 20 years?' },
    { cat: 'Environment', difficulty: 'medium', q: 'Do you think cities or rural areas are better places to live? Why?' },
    { cat: 'Work & Economy', difficulty: 'medium', q: 'Is it better for young people to gain work experience or continue studying after high school? Why?' },
  ]
};

/* ─── Impromptu Bank ─────────────────────────────────────────────────────── */
const IMPROMPTU_BANK = [
  // 💬 General
  { cat: 'General', difficulty: 'easy',   q: 'What is a hill you will absolutely die on?' },
  { cat: 'General', difficulty: 'easy',   q: 'What is an unwritten rule everyone should know?' },
  { cat: 'General', difficulty: 'easy',   q: 'What is the most overrated life advice people keep repeating?' },
  { cat: 'General', difficulty: 'medium', q: 'Is it better to be respected or liked? Pick one.' },
  { cat: 'General', difficulty: 'medium', q: 'What is something you believed at 16 that you now think is completely wrong?' },
  { cat: 'General', difficulty: 'medium', q: 'Would you rather be the smartest person in every room, or the most fun?' },
  { cat: 'General', difficulty: 'hard',   q: 'Is ambition actually just anxiety with good PR?' },
  { cat: 'General', difficulty: 'hard',   q: 'What is the most honest thing you could say about yourself right now?' },
  // 💻 Tech
  { cat: 'Tech', difficulty: 'easy',   q: 'What app do you hate but cannot delete?' },
  { cat: 'Tech', difficulty: 'easy',   q: 'If the internet went down for a week, what would you do first?' },
  { cat: 'Tech', difficulty: 'medium', q: 'Is the smartphone the best or worst invention of the past 50 years?' },
  { cat: 'Tech', difficulty: 'medium', q: 'What is the most overhyped piece of technology right now?' },
  { cat: 'Tech', difficulty: 'medium', q: 'If you had to delete all social media except one, which survives and why?' },
  { cat: 'Tech', difficulty: 'hard',   q: 'We outsource our memory to Google. Is that evolution or laziness?' },
  { cat: 'Tech', difficulty: 'hard',   q: 'Should there be an age limit for using the internet unsupervised?' },
  // 💰 Finance
  { cat: 'Finance', difficulty: 'easy',   q: 'What is the dumbest thing people spend money on?' },
  { cat: 'Finance', difficulty: 'easy',   q: 'Should kids be paid for doing chores?' },
  { cat: 'Finance', difficulty: 'medium', q: 'Is "follow your passion" actually terrible financial advice?' },
  { cat: 'Finance', difficulty: 'medium', q: 'At what point does someone have too much money?' },
  { cat: 'Finance', difficulty: 'hard',   q: 'Is the stock market just a legal casino? Defend your answer.' },
  { cat: 'Finance', difficulty: 'hard',   q: 'Should billionaires exist? 60 seconds, go.' },
  // 🔥 Roast It
  { cat: 'Roast It', difficulty: 'easy',   q: 'Roast open-plan offices like your life depends on it.' },
  { cat: 'Roast It', difficulty: 'easy',   q: 'Roast group projects. You know why.' },
  { cat: 'Roast It', difficulty: 'easy',   q: 'Roast LinkedIn. Be brutally honest.' },
  { cat: 'Roast It', difficulty: 'medium', q: 'Roast hustle culture and everyone who posts about it at 5 AM.' },
  { cat: 'Roast It', difficulty: 'medium', q: 'Roast motivational posters. Every single one.' },
  { cat: 'Roast It', difficulty: 'hard',   q: 'Roast the concept of "networking" — why is it just begging with a business card?' },
  // 💡 One-Minute Pitch
  { cat: 'One-Minute Pitch', difficulty: 'easy',   q: 'Pitch a new national holiday. Sell it hard.' },
  { cat: 'One-Minute Pitch', difficulty: 'easy',   q: 'Pitch an app idea that does not exist yet but should.' },
  { cat: 'One-Minute Pitch', difficulty: 'medium', q: 'Pitch why your city should host the next World Cup.' },
  { cat: 'One-Minute Pitch', difficulty: 'medium', q: 'Pitch replacing one school subject with something more useful.' },
  { cat: 'One-Minute Pitch', difficulty: 'hard',   q: 'Pitch the four-day work week to a room of sceptical CEOs in 60 seconds.' },
  { cat: 'One-Minute Pitch', difficulty: 'hard',   q: "Pitch yourself as the world's greatest expert in something ridiculous." },
  // 🤡 Defend It
  { cat: 'Defend It', difficulty: 'easy',   q: 'Defend pineapple on pizza. No irony. Full commitment.' },
  { cat: 'Defend It', difficulty: 'easy',   q: 'Defend napping at work as official company policy.' },
  { cat: 'Defend It', difficulty: 'easy',   q: 'Defend the mullet as the superior hairstyle.' },
  { cat: 'Defend It', difficulty: 'medium', q: 'Defend procrastination as a legitimate productivity strategy.' },
  { cat: 'Defend It', difficulty: 'medium', q: 'Defend always being late as a sign of creativity.' },
  { cat: 'Defend It', difficulty: 'hard',   q: 'Defend reality TV as genuinely important cultural content.' },
  { cat: 'Defend It', difficulty: 'hard',   q: 'Defend the idea that failure is more valuable than success.' },
  // 👶 Explain It Like You're 5
  { cat: "Explain It Like You're 5", difficulty: 'easy',   q: 'Explain taxes to a 6-year-old who just got pocket money.' },
  { cat: "Explain It Like You're 5", difficulty: 'easy',   q: 'Explain why adults go to work every day, to a kid who thinks it sounds awful.' },
  { cat: "Explain It Like You're 5", difficulty: 'medium', q: 'Explain inflation without using the words "money", "price", or "economy".' },
  { cat: "Explain It Like You're 5", difficulty: 'medium', q: 'Explain how the internet works using only food.' },
  { cat: "Explain It Like You're 5", difficulty: 'hard',   q: 'Explain why humans go to war — to a child who thinks fighting is always silly.' },
  { cat: "Explain It Like You're 5", difficulty: 'hard',   q: 'Explain death to a 5-year-old without being sad or lying.' },
  // 🌶️ Hot Takes
  { cat: 'Hot Takes', difficulty: 'easy',   q: 'Homework is just busywork and everyone knows it.' },
  { cat: 'Hot Takes', difficulty: 'easy',   q: 'Most meetings could have been a two-line text message.' },
  { cat: 'Hot Takes', difficulty: 'medium', q: 'Cereal is not breakfast. It is a dessert with a PR problem.' },
  { cat: 'Hot Takes', difficulty: 'medium', q: 'Adulthood was massively oversold to us as children.' },
  { cat: 'Hot Takes', difficulty: 'medium', q: 'Travelling does not make you more interesting. Being interesting makes you interesting.' },
  { cat: 'Hot Takes', difficulty: 'hard',   q: 'The most dangerous thing you can teach a child is blind respect for authority.' },
  { cat: 'Hot Takes', difficulty: 'hard',   q: 'Small talk is a social tax paid by introverts to make extroverts comfortable.' },
];

/* ─── Vocabulary Bank ────────────────────────────────────────────────────── */
const VOCAB_BANK = {
  'General English': {
    B1: [
      { word: 'curious',      definition: 'Eager to know or learn something',                        vietnamese: 'tò mò',           collocations: ['curious about', 'naturally curious'],            example: 'She was curious about how the machine worked.' },
      { word: 'grateful',     definition: 'Feeling thankful for something received',                  vietnamese: 'biết ơn',         collocations: ['deeply grateful', 'grateful for'],               example: 'I am grateful for all the help you gave me.' },
      { word: 'confident',    definition: 'Feeling sure about your own abilities',                    vietnamese: 'tự tin',          collocations: ['feel confident', 'confident in'],                example: 'She felt confident before her presentation.' },
      { word: 'patient',      definition: 'Able to wait calmly without getting upset',               vietnamese: 'kiên nhẫn',       collocations: ['be patient', 'patient with'],                    example: 'You need to be patient while the system loads.' },
      { word: 'generous',     definition: 'Willing to give money, time, or help freely',             vietnamese: 'hào phóng',       collocations: ['generous donation', 'very generous'],            example: 'He was generous with his time and advice.' },
      { word: 'honest',       definition: 'Telling the truth and not cheating',                      vietnamese: 'trung thực',      collocations: ['be honest', 'brutally honest'],                  example: 'She was always honest with her friends.' },
      { word: 'creative',     definition: 'Able to produce new and imaginative ideas',               vietnamese: 'sáng tạo',        collocations: ['creative solution', 'highly creative'],          example: 'The designer came up with a very creative idea.' },
      { word: 'ambitious',    definition: 'Having a strong desire to succeed',                        vietnamese: 'tham vọng',       collocations: ['highly ambitious', 'ambitious goal'],            example: 'He is ambitious and works very hard.' },
      { word: 'flexible',     definition: 'Able to change or adapt easily',                           vietnamese: 'linh hoạt',       collocations: ['flexible schedule', 'remain flexible'],         example: 'We need to be flexible when plans change.' },
      { word: 'reliable',     definition: 'Consistently trustworthy and dependable',                  vietnamese: 'đáng tin cậy',   collocations: ['reliable source', 'completely reliable'],        example: 'A reliable car is essential for long trips.' },
      { word: 'sociable',     definition: 'Enjoying the company of others; friendly',                 vietnamese: 'hòa đồng',       collocations: ['very sociable', 'sociable person'],              example: 'My sister is very sociable and loves parties.' },
      { word: 'nervous',      definition: 'Anxious or worried about something',                       vietnamese: 'lo lắng',        collocations: ['feel nervous', 'nervous about'],                 example: 'He was nervous before the big exam.' },
      { word: 'responsible',  definition: 'Having the duty to deal with or take care of something',  vietnamese: 'có trách nhiệm', collocations: ['responsible for', 'highly responsible'],         example: 'Parents are responsible for their children.' },
      { word: 'independent',  definition: 'Not needing others for support; self-reliant',            vietnamese: 'độc lập',        collocations: ['become independent', 'financially independent'], example: 'She became more independent after moving abroad.' },
      { word: 'cheerful',     definition: 'Noticeably happy and optimistic',                          vietnamese: 'vui vẻ',         collocations: ['cheerful mood', 'always cheerful'],              example: 'He has a cheerful personality that lifts the room.' },
    ],
    B2: [
      { word: 'diligent',      definition: 'Careful and hard-working',                               vietnamese: 'chăm chỉ',         collocations: ['diligent student', 'diligent worker'],          example: 'She is a diligent student who never misses class.' },
      { word: 'resilient',     definition: 'Able to recover quickly from difficulties',              vietnamese: 'kiên cường',       collocations: ['resilient spirit', 'emotionally resilient'],    example: 'Children are often more resilient than adults think.' },
      { word: 'compassionate', definition: 'Feeling sympathy and concern for others\' suffering',   vietnamese: 'đầy lòng trắc ẩn', collocations: ['compassionate care', 'deeply compassionate'],   example: 'The nurse was compassionate towards all patients.' },
      { word: 'articulate',    definition: 'Having or showing the ability to speak clearly',         vietnamese: 'lưu loát',         collocations: ['articulate speaker', 'clearly articulate'],     example: 'She is articulate and expresses herself very well.' },
      { word: 'pragmatic',     definition: 'Dealing with things sensibly and realistically',         vietnamese: 'thực tế',          collocations: ['pragmatic approach', 'pragmatic solution'],     example: 'We need a pragmatic approach to solve this.' },
      { word: 'versatile',     definition: 'Able to adapt to many different functions',              vietnamese: 'đa năng',          collocations: ['versatile player', 'highly versatile'],         example: 'He is a versatile employee who handles many tasks.' },
      { word: 'meticulous',    definition: 'Very careful and precise about details',                 vietnamese: 'tỉ mỉ',            collocations: ['meticulous attention', 'meticulous planning'],  example: 'She is meticulous in her research.' },
      { word: 'persistent',    definition: 'Continuing firmly despite obstacles',                    vietnamese: 'kiên trì',         collocations: ['persistent effort', 'be persistent'],           example: 'Success requires persistent effort.' },
      { word: 'eloquent',      definition: 'Fluent and persuasive in speaking or writing',           vietnamese: 'hùng hồn',         collocations: ['eloquent speech', 'eloquent writer'],           example: 'The leader gave an eloquent speech.' },
      { word: 'impulsive',     definition: 'Acting quickly without thinking first',                  vietnamese: 'bốc đồng',         collocations: ['impulsive decision', 'act impulsively'],        example: 'He made an impulsive decision to quit his job.' },
      { word: 'empathetic',    definition: 'Showing empathy; understanding others\' feelings',       vietnamese: 'đồng cảm',         collocations: ['empathetic listener', 'be empathetic'],         example: 'Good teachers are empathetic to their students.' },
      { word: 'introspective', definition: 'Tending to examine your own thoughts and feelings',      vietnamese: 'hướng nội',        collocations: ['introspective person', 'deeply introspective'], example: 'She became introspective after the difficult year.' },
      { word: 'cynical',       definition: 'Believing people are motivated by self-interest',        vietnamese: 'hoài nghi',        collocations: ['cynical view', 'grow cynical'],                 example: 'Years of disappointment made him cynical.' },
      { word: 'arrogant',      definition: 'Having an exaggerated sense of one\'s own importance',  vietnamese: 'kiêu ngạo',        collocations: ['arrogant attitude', 'come across as arrogant'], example: 'His arrogant behaviour upset his colleagues.' },
      { word: 'tenacious',     definition: 'Holding firmly to something; very determined',           vietnamese: 'bền bỉ',           collocations: ['tenacious effort', 'tenacious spirit'],         example: 'She was tenacious in pursuing her goals.' },
    ],
    C1: [
      { word: 'magnanimous',   definition: 'Very generous and forgiving, especially towards rivals', vietnamese: 'khoan dung',       collocations: ['magnanimous gesture', 'be magnanimous'],        example: 'The champion was magnanimous in victory.' },
      { word: 'reticent',      definition: 'Not revealing your thoughts or feelings readily',        vietnamese: 'kín đáo',          collocations: ['reticent nature', 'be reticent about'],         example: 'He was reticent about his past experiences.' },
      { word: 'sanguine',      definition: 'Optimistic, especially in a difficult situation',        vietnamese: 'lạc quan',         collocations: ['remain sanguine', 'sanguine outlook'],          example: 'She remained sanguine despite the setbacks.' },
      { word: 'vehement',      definition: 'Showing strong feeling; forceful and passionate',        vietnamese: 'quyết liệt',       collocations: ['vehement opposition', 'vehement denial'],       example: 'He was vehement in his opposition to the plan.' },
      { word: 'impartial',     definition: 'Treating all rivals or parties equally; fair',           vietnamese: 'vô tư, công bằng', collocations: ['impartial judge', 'remain impartial'],          example: 'The judge must remain impartial during the trial.' },
      { word: 'gregarious',    definition: 'Enjoying the company of others; sociable',               vietnamese: 'ưa giao tiếp',     collocations: ['gregarious personality', 'very gregarious'],    example: 'She is gregarious and loves meeting new people.' },
      { word: 'languid',       definition: 'Weak or slow in a relaxed, pleasant way',                vietnamese: 'uể oải',           collocations: ['languid pace', 'languid gesture'],              example: 'He moved with languid grace through the room.' },
      { word: 'judicious',     definition: 'Having or showing sound judgement',                      vietnamese: 'sáng suốt',        collocations: ['judicious decision', 'judicious use'],          example: 'A judicious choice of words avoided conflict.' },
      { word: 'obstinate',     definition: 'Stubbornly refusing to change one\'s opinion',           vietnamese: 'cứng đầu',         collocations: ['obstinate refusal', 'remain obstinate'],        example: 'He was obstinate and refused to listen to advice.' },
      { word: 'fervent',       definition: 'Having or displaying passionate intensity',              vietnamese: 'nhiệt thành',      collocations: ['fervent supporter', 'fervent belief'],          example: 'She was a fervent advocate for human rights.' },
      { word: 'contemplative', definition: 'Expressing or involving prolonged thought',              vietnamese: 'trầm tư',          collocations: ['contemplative mood', 'contemplative silence'],  example: 'He sat in contemplative silence after the news.' },
      { word: 'benevolent',    definition: 'Well-meaning and kindly; charitable',                    vietnamese: 'nhân từ',          collocations: ['benevolent leader', 'benevolent smile'],        example: 'The benevolent donor funded the school library.' },
      { word: 'discerning',    definition: 'Having or showing good judgement; perceptive',           vietnamese: 'tinh tế, sắc bén', collocations: ['discerning eye', 'discerning taste'],           example: 'A discerning reader will notice the subtle errors.' },
      { word: 'placid',        definition: 'Calm and peaceful; not easily upset',                    vietnamese: 'điềm tĩnh',        collocations: ['placid temperament', 'remain placid'],          example: 'The lake was placid in the early morning.' },
      { word: 'nonchalant',    definition: 'Feeling or appearing calm and relaxed; unconcerned',     vietnamese: 'thờ ơ, bình thản', collocations: ['nonchalant attitude', 'appear nonchalant'],      example: 'He was nonchalant about the challenging exam.' },
    ],
    C2: [
      { word: 'acrimonious',   definition: 'Typically of speech or manner: angry and bitter',        vietnamese: 'gay gắt, chua cay',  collocations: ['acrimonious dispute', 'acrimonious divorce'],    example: 'The debate became increasingly acrimonious.' },
      { word: 'diffident',     definition: 'Modest or shy due to a lack of self-confidence',         vietnamese: 'nhút nhát, e dè',    collocations: ['diffident manner', 'appear diffident'],          example: 'She was diffident in voicing her opinions.' },
      { word: 'garrulous',     definition: 'Excessively talkative, especially on trivial matters',   vietnamese: 'ba hoa, lắm lời',    collocations: ['garrulous neighbour', 'garrulous nature'],       example: 'The garrulous guest dominated the conversation.' },
      { word: 'laconic',       definition: 'Using very few words',                                    vietnamese: 'kiệm lời',           collocations: ['laconic reply', 'laconic style'],                example: 'His laconic reply ended the discussion.' },
      { word: 'mendacious',    definition: 'Not telling the truth; lying',                            vietnamese: 'dối trá',            collocations: ['mendacious claim', 'thoroughly mendacious'],     example: 'The mendacious report misled the public.' },
      { word: 'obsequious',    definition: 'Overly obedient and eager to please',                     vietnamese: 'nịnh hót, xu nịnh',  collocations: ['obsequious manner', 'obsequious assistant'],     example: 'His obsequious behaviour irritated his boss.' },
      { word: 'pugnacious',    definition: 'Eager or quick to argue, quarrel, or fight',              vietnamese: 'hiếu chiến',         collocations: ['pugnacious style', 'pugnacious attitude'],       example: 'The pugnacious politician loved a debate.' },
      { word: 'querulous',     definition: 'Complaining in a petulant or whining manner',             vietnamese: 'hay ca thán',        collocations: ['querulous tone', 'querulous complaint'],         example: 'The querulous customer complained constantly.' },
      { word: 'fastidious',    definition: 'Very attentive to accuracy and detail; difficult to please', vietnamese: 'cầu kỳ, khó tính', collocations: ['fastidious attention', 'fastidious taste'],      example: 'She is fastidious about the quality of her work.' },
      { word: 'bellicose',     definition: 'Demonstrating aggression; eager to fight',                vietnamese: 'hiếu chiến, hung hăng', collocations: ['bellicose rhetoric', 'bellicose nation'],     example: 'His bellicose speech alarmed the diplomats.' },
      { word: 'circumspect',   definition: 'Unwilling to take risks; wary and cautious',              vietnamese: 'thận trọng',         collocations: ['circumspect approach', 'remain circumspect'],    example: 'She was circumspect in her financial decisions.' },
      { word: 'equanimous',    definition: 'Having mental calmness, especially in difficult situations', vietnamese: 'bình tĩnh, điềm đạm', collocations: ['equanimous response', 'remain equanimous'],   example: 'He faced adversity with an equanimous spirit.' },
      { word: 'hegemonic',     definition: 'Relating to dominance or authority over others',          vietnamese: 'bá quyền',           collocations: ['hegemonic power', 'hegemonic control'],          example: 'The country sought to maintain hegemonic influence.' },
      { word: 'inimical',      definition: 'Tending to obstruct or harm; hostile',                    vietnamese: 'thù địch, có hại',   collocations: ['inimical to progress', 'inimical force'],        example: 'His attitude was inimical to teamwork.' },
      { word: 'jocular',       definition: 'Fond of or characterised by joking; playful',             vietnamese: 'hay đùa, hài hước',  collocations: ['jocular tone', 'jocular remark'],                example: 'He made a jocular comment to lighten the mood.' },
    ],
  },
  'Business': {
    B1: [
      { word: 'profit',      definition: 'Financial gain after expenses are deducted',                 vietnamese: 'lợi nhuận',      collocations: ['make a profit', 'profit margin'],             example: 'The company made a large profit last year.' },
      { word: 'budget',      definition: 'An estimate of income and expenditure for a period',         vietnamese: 'ngân sách',      collocations: ['annual budget', 'budget cut'],                example: 'We need to work within a tight budget.' },
      { word: 'client',      definition: 'A person who uses the services of a professional',           vietnamese: 'khách hàng',     collocations: ['key client', 'attract clients'],              example: 'The firm has several major clients overseas.' },
      { word: 'market',      definition: 'An area or arena in which commercial dealings are done',     vietnamese: 'thị trường',     collocations: ['market share', 'enter the market'],          example: 'They plan to enter the Asian market next year.' },
      { word: 'invest',      definition: 'To put money into a project expecting a return',             vietnamese: 'đầu tư',         collocations: ['invest in', 'invest heavily'],                example: 'She decided to invest in renewable energy.' },
      { word: 'salary',      definition: 'A fixed regular payment for employment',                     vietnamese: 'lương',          collocations: ['monthly salary', 'raise a salary'],          example: 'He received a salary raise after two years.' },
      { word: 'product',     definition: 'An article or substance manufactured for sale',              vietnamese: 'sản phẩm',       collocations: ['new product', 'product launch'],              example: 'The company is launching a new product next month.' },
      { word: 'compete',     definition: 'To strive to gain something by defeating others',            vietnamese: 'cạnh tranh',     collocations: ['compete for', 'compete with'],               example: 'Small firms struggle to compete with large ones.' },
      { word: 'manage',      definition: 'To be in charge of; to administer',                          vietnamese: 'quản lý',        collocations: ['manage a team', 'manage resources'],         example: 'She manages a team of fifteen people.' },
      { word: 'demand',      definition: 'The desire of consumers to purchase goods',                  vietnamese: 'nhu cầu',        collocations: ['high demand', 'meet demand'],                example: 'There is high demand for electric vehicles.' },
      { word: 'supply',      definition: 'The amount of a commodity available for purchase',           vietnamese: 'nguồn cung',     collocations: ['supply chain', 'supply and demand'],         example: 'The supply of raw materials was disrupted.' },
      { word: 'growth',      definition: 'An increase in the size or importance of something',         vietnamese: 'tăng trưởng',    collocations: ['economic growth', 'business growth'],        example: 'The company reported strong growth this quarter.' },
      { word: 'target',      definition: 'An objective or result to achieve',                          vietnamese: 'mục tiêu',       collocations: ['sales target', 'meet a target'],             example: 'The team exceeded its sales target this month.' },
      { word: 'offer',       definition: 'To present something for acceptance',                        vietnamese: 'đề nghị, ưu đãi', collocations: ['job offer', 'offer a discount'],            example: 'She accepted the job offer on Friday.' },
      { word: 'service',     definition: 'The action of helping or doing work for someone',            vietnamese: 'dịch vụ',        collocations: ['customer service', 'service quality'],       example: 'The restaurant offers excellent customer service.' },
    ],
    B2: [
      { word: 'entrepreneur', definition: 'A person who sets up a business to make a profit',         vietnamese: 'doanh nhân',        collocations: ['successful entrepreneur', 'young entrepreneur'], example: 'She became a successful entrepreneur at 25.' },
      { word: 'revenue',      definition: 'Income generated from business activities',                 vietnamese: 'doanh thu',         collocations: ['annual revenue', 'revenue growth'],              example: 'The company\'s revenue doubled this year.' },
      { word: 'stakeholder',  definition: 'A person with an interest in a business\'s success',       vietnamese: 'bên liên quan',     collocations: ['key stakeholder', 'stakeholder meeting'],        example: 'Stakeholders were briefed on the new strategy.' },
      { word: 'negotiate',    definition: 'To reach an agreement through discussion',                  vietnamese: 'đàm phán',          collocations: ['negotiate a deal', 'negotiate terms'],           example: 'They negotiated a better contract with the supplier.' },
      { word: 'merger',       definition: 'The combination of two companies into one',                 vietnamese: 'sáp nhập',          collocations: ['company merger', 'merger deal'],                 example: 'The merger created the world\'s largest bank.' },
      { word: 'outsource',    definition: 'To obtain goods or services from an outside supplier',      vietnamese: 'thuê ngoài',        collocations: ['outsource production', 'outsource IT'],          example: 'Many firms outsource their customer support.' },
      { word: 'benchmark',    definition: 'A standard to measure something against',                   vietnamese: 'tiêu chuẩn đánh giá', collocations: ['industry benchmark', 'set a benchmark'],      example: 'This report sets a benchmark for the industry.' },
      { word: 'dividend',     definition: 'A payment made to shareholders from company profits',       vietnamese: 'cổ tức',            collocations: ['pay a dividend', 'dividend yield'],              example: 'The company paid a generous dividend to investors.' },
      { word: 'franchise',    definition: 'A license to sell a company\'s products using its brand',  vietnamese: 'nhượng quyền',      collocations: ['franchise agreement', 'buy a franchise'],        example: 'He bought a fast-food franchise last year.' },
      { word: 'liability',    definition: 'A thing for which someone is responsible, esp. a debt',    vietnamese: 'nghĩa vụ, nợ',     collocations: ['legal liability', 'limit liability'],            example: 'The company has limited liability for damages.' },
      { word: 'asset',        definition: 'An item of property owned by a person or company',         vietnamese: 'tài sản',           collocations: ['valuable asset', 'fixed asset'],                 example: 'Property is the company\'s most valuable asset.' },
      { word: 'turnover',     definition: 'The amount of money a business makes in a period',         vietnamese: 'doanh số',          collocations: ['annual turnover', 'high turnover'],              example: 'The shop has a turnover of £1 million a year.' },
      { word: 'acquisition',  definition: 'Buying another company or assets',                          vietnamese: 'mua lại',           collocations: ['major acquisition', 'acquisition deal'],         example: 'The acquisition of the startup cost $50 million.' },
      { word: 'rebrand',      definition: 'To change the image of a company or product',               vietnamese: 'đổi thương hiệu',   collocations: ['rebrand strategy', 'fully rebrand'],             example: 'The company decided to rebrand after the scandal.' },
      { word: 'recession',    definition: 'A temporary period of economic decline',                    vietnamese: 'suy thoái kinh tế', collocations: ['economic recession', 'hit by recession'],        example: 'The recession caused many businesses to close.' },
    ],
    C1: [
      { word: 'liquidity',    definition: 'The availability of liquid assets to a company',            vietnamese: 'tính thanh khoản',  collocations: ['liquidity crisis', 'improve liquidity'],         example: 'The bank maintained high liquidity during the crisis.' },
      { word: 'leverage',     definition: 'Using borrowed capital to increase potential return',       vietnamese: 'đòn bẩy tài chính', collocations: ['financial leverage', 'leverage capital'],        example: 'The firm used leverage to expand its investments.' },
      { word: 'subsidiary',   definition: 'A company controlled by a holding company',                 vietnamese: 'công ty con',       collocations: ['wholly-owned subsidiary', 'set up a subsidiary'], example: 'The subsidiary operates in five Asian countries.' },
      { word: 'monetize',     definition: 'To earn money from something, especially online content',   vietnamese: 'kiếm tiền từ',      collocations: ['monetize content', 'monetize data'],             example: 'The app was redesigned to better monetize user data.' },
      { word: 'diversify',    definition: 'To spread investment across different areas',               vietnamese: 'đa dạng hóa',       collocations: ['diversify portfolio', 'diversify risk'],         example: 'The investor diversified into real estate.' },
      { word: 'procurement',  definition: 'The act of obtaining goods or services for an organization', vietnamese: 'mua sắm, tổ chức mua hàng', collocations: ['procurement process', 'procurement officer'], example: 'The procurement process was delayed by paperwork.' },
      { word: 'depreciation', definition: 'Reduction in value of an asset over time',                  vietnamese: 'khấu hao',          collocations: ['asset depreciation', 'accelerated depreciation'], example: 'The car\'s depreciation reduces its resale value.' },
      { word: 'consortium',   definition: 'An association of companies with shared interests',         vietnamese: 'tập đoàn liên kết',  collocations: ['form a consortium', 'banking consortium'],       example: 'A consortium of investors funded the project.' },
      { word: 'insolvency',   definition: 'The state of being unable to pay one\'s debts',            vietnamese: 'tình trạng mất khả năng thanh toán', collocations: ['declare insolvency', 'insolvency risk'], example: 'The firm filed for insolvency after losing clients.' },
      { word: 'equity',       definition: 'The value of shares in a company; fair ownership',         vietnamese: 'vốn chủ sở hữu',    collocations: ['private equity', 'equity stake'],               example: 'She has a 30% equity stake in the startup.' },
      { word: 'hedge',        definition: 'To make investments to offset potential losses',            vietnamese: 'bảo hiểm rủi ro',   collocations: ['hedge against risk', 'hedge fund'],              example: 'Companies often hedge against currency fluctuations.' },
      { word: 'fiduciary',    definition: 'Involving trust, especially with financial management',     vietnamese: 'ủy thác, ủy quyền', collocations: ['fiduciary duty', 'fiduciary responsibility'],    example: 'Directors have a fiduciary duty to shareholders.' },
      { word: 'remunerate',   definition: 'To pay someone for services or work',                       vietnamese: 'trả thù lao',       collocations: ['adequately remunerate', 'remunerate staff'],     example: 'The contract failed to adequately remunerate workers.' },
      { word: 'arbitrage',    definition: 'Buying and selling to profit from price differences',       vietnamese: 'kinh doanh chênh lệch giá', collocations: ['arbitrage opportunity', 'arbitrage strategy'], example: 'Traders exploited arbitrage between two markets.' },
      { word: 'syndicate',    definition: 'A group of individuals or firms combined to promote a common interest', vietnamese: 'tổ hợp, tập đoàn', collocations: ['media syndicate', 'loan syndicate'],   example: 'A bank syndicate financed the construction project.' },
    ],
    C2: [
      { word: 'oligopoly',     definition: 'A market dominated by a small number of large sellers',   vietnamese: 'thị trường độc quyền nhóm', collocations: ['oligopoly market', 'natural oligopoly'],  example: 'The tech industry is often described as an oligopoly.' },
      { word: 'divestiture',   definition: 'The action of selling off subsidiary business interests', vietnamese: 'thoái vốn',          collocations: ['forced divestiture', 'divestiture plan'],        example: 'The regulator ordered the divestiture of assets.' },
      { word: 'amortization',  definition: 'Gradual repayment of a debt over time',                   vietnamese: 'khấu hao khoản nợ', collocations: ['loan amortization', 'amortization schedule'],    example: 'The mortgage is paid off through amortization.' },
      { word: 'collateral',    definition: 'Property pledged as security for repayment of a loan',    vietnamese: 'tài sản thế chấp',  collocations: ['use as collateral', 'collateral damage'],        example: 'His house was used as collateral for the loan.' },
      { word: 'securitization',definition: 'Converting assets into marketable securities',             vietnamese: 'chứng khoán hóa tài sản', collocations: ['mortgage securitization', 'securitization deal'], example: 'Securitization played a role in the 2008 crash.' },
      { word: 'monopsony',     definition: 'A market with only one buyer, who controls prices',       vietnamese: 'độc quyền mua',     collocations: ['monopsony power', 'labour monopsony'],           example: 'A single employer with monopsony power can lower wages.' },
      { word: 'underwrite',    definition: 'To accept financial responsibility for; to guarantee',    vietnamese: 'bảo lãnh phát hành', collocations: ['underwrite a loan', 'underwrite risk'],         example: 'The bank agreed to underwrite the bond issue.' },
      { word: 'receivership',  definition: 'Process where a receiver manages a company\'s assets',   vietnamese: 'kiểm soát tài chính', collocations: ['go into receivership', 'placed in receivership'], example: 'The failing company was placed in receivership.' },
      { word: 'promissory',    definition: 'Conveying a promise, especially of payment',              vietnamese: 'hứa trả, hứa hẹn', collocations: ['promissory note', 'promissory agreement'],        example: 'He signed a promissory note for the debt.' },
      { word: 'perpetuity',    definition: 'A bond or other security with no fixed maturity date',    vietnamese: 'vĩnh viễn, vô thời hạn', collocations: ['in perpetuity', 'perpetuity bond'],         example: 'The land was granted to the family in perpetuity.' },
      { word: 'macroeconomic', definition: 'Relating to large-scale economic factors',                 vietnamese: 'kinh tế vĩ mô',    collocations: ['macroeconomic policy', 'macroeconomic trend'],   example: 'Inflation is a key macroeconomic concern.' },
      { word: 'expropriation', definition: 'Government taking of private property for public use',    vietnamese: 'trưng thu tài sản', collocations: ['government expropriation', 'risk of expropriation'], example: 'Investors feared expropriation under the new law.' },
      { word: 'encumbrance',   definition: 'A burden or claim attached to a property',                vietnamese: 'gánh nặng, tài sản thế chấp', collocations: ['legal encumbrance', 'free from encumbrance'], example: 'The property was sold free of any encumbrance.' },
      { word: 'subrogation',   definition: 'Substitution of one party for another in a legal claim', vietnamese: 'thế quyền (bảo hiểm)', collocations: ['right of subrogation', 'subrogation clause'],  example: 'The insurer exercised its right of subrogation.' },
      { word: 'microeconomic', definition: 'Relating to individual firms, households, and markets',   vietnamese: 'kinh tế vi mô',    collocations: ['microeconomic analysis', 'microeconomic model'],  example: 'Consumer choice is a microeconomic concept.' },
    ],
  },
  'Academic': {
    B1: [
      { word: 'analyse',    definition: 'To examine in detail in order to explain',                    vietnamese: 'phân tích',        collocations: ['analyse data', 'critically analyse'],          example: 'We need to analyse the results carefully.' },
      { word: 'research',   definition: 'Systematic investigation to establish facts',                  vietnamese: 'nghiên cứu',       collocations: ['conduct research', 'research paper'],          example: 'He conducted research on climate change.' },
      { word: 'argument',   definition: 'A reason given in support of an idea',                        vietnamese: 'lập luận',         collocations: ['strong argument', 'present an argument'],      example: 'She made a strong argument for the policy.' },
      { word: 'evidence',   definition: 'Information indicating that something is true',               vietnamese: 'bằng chứng',       collocations: ['provide evidence', 'strong evidence'],         example: 'The study provided clear evidence of the link.' },
      { word: 'theory',     definition: 'A system of ideas to explain something',                       vietnamese: 'lý thuyết',        collocations: ['develop a theory', 'in theory'],               example: 'Darwin developed a theory of natural selection.' },
      { word: 'method',     definition: 'A particular procedure for accomplishing something',           vietnamese: 'phương pháp',      collocations: ['research method', 'teaching method'],          example: 'The survey method was used to collect data.' },
      { word: 'data',       definition: 'Facts and statistics collected for reference',                 vietnamese: 'dữ liệu',          collocations: ['collect data', 'data analysis'],               example: 'The data shows a clear upward trend.' },
      { word: 'source',     definition: 'A place from which information is obtained',                   vietnamese: 'nguồn tài liệu',   collocations: ['reliable source', 'cite a source'],            example: 'Always cite your sources in academic writing.' },
      { word: 'thesis',     definition: 'A statement put forward to be supported or proved',            vietnamese: 'luận điểm',        collocations: ['thesis statement', 'support the thesis'],      example: 'Your essay needs a clear thesis statement.' },
      { word: 'compare',    definition: 'To examine the similarity between two things',                 vietnamese: 'so sánh',          collocations: ['compare and contrast', 'compare results'],     example: 'Compare the two studies and identify differences.' },
      { word: 'evaluate',   definition: 'To assess the value or quality of something',                  vietnamese: 'đánh giá',         collocations: ['critically evaluate', 'evaluate evidence'],    example: 'You should evaluate each source carefully.' },
      { word: 'summary',    definition: 'A brief statement of the main points',                         vietnamese: 'tóm tắt',          collocations: ['executive summary', 'write a summary'],        example: 'Write a summary of the article in 100 words.' },
      { word: 'conclude',   definition: 'To arrive at a judgement after reasoning',                     vietnamese: 'kết luận',         collocations: ['conclude that', 'reasonably conclude'],        example: 'The study concludes that exercise improves mood.' },
      { word: 'define',     definition: 'To state the exact meaning of a word',                         vietnamese: 'định nghĩa',       collocations: ['define a term', 'clearly defined'],            example: 'Please define the key terms in your introduction.' },
      { word: 'topic',      definition: 'A subject under discussion or study',                          vietnamese: 'chủ đề',           collocations: ['main topic', 'off-topic'],                      example: 'Choose a topic that interests you for your essay.' },
    ],
    B2: [
      { word: 'hypothesis',   definition: 'A proposed explanation to be tested',                       vietnamese: 'giả thuyết',       collocations: ['test a hypothesis', 'support a hypothesis'],   example: 'The researchers tested their hypothesis with surveys.' },
      { word: 'methodology',  definition: 'A system of methods used in a field',                       vietnamese: 'phương pháp luận', collocations: ['research methodology', 'clear methodology'],    example: 'The paper outlines its methodology in detail.' },
      { word: 'empirical',    definition: 'Based on observation and experiment, not theory',            vietnamese: 'thực nghiệm',      collocations: ['empirical evidence', 'empirical study'],        example: 'Empirical evidence supports the new treatment.' },
      { word: 'citation',     definition: 'A reference to a published work',                           vietnamese: 'trích dẫn',        collocations: ['in-text citation', 'citation style'],           example: 'Ensure every claim has an accurate citation.' },
      { word: 'correlation',  definition: 'A mutual relationship or connection between things',         vietnamese: 'tương quan',       collocations: ['positive correlation', 'show correlation'],     example: 'There is a correlation between stress and illness.' },
      { word: 'framework',    definition: 'A basic structure underlying a system',                     vietnamese: 'khung lý thuyết',  collocations: ['theoretical framework', 'analytical framework'], example: 'The study uses a sociological framework.' },
      { word: 'paradigm',     definition: 'A typical example or a model of something',                 vietnamese: 'mô hình tư duy',   collocations: ['paradigm shift', 'dominant paradigm'],          example: 'The discovery led to a major paradigm shift.' },
      { word: 'implication',  definition: 'A conclusion drawn from evidence; a likely consequence',    vietnamese: 'hàm ý, tác động', collocations: ['broader implication', 'policy implication'],     example: 'The findings have important policy implications.' },
      { word: 'discourse',    definition: 'Written or spoken communication on a topic',                vietnamese: 'diễn ngôn',        collocations: ['academic discourse', 'public discourse'],        example: 'This shapes academic discourse on climate.' },
      { word: 'premise',      definition: 'A statement on which an argument is based',                 vietnamese: 'tiền đề',          collocations: ['false premise', 'underlying premise'],          example: 'The argument rests on a faulty premise.' },
      { word: 'rationale',    definition: 'The reasons behind a course of action',                     vietnamese: 'lý do, căn cứ',   collocations: ['clear rationale', 'provide rationale'],          example: 'The paper explains the rationale for the study.' },
      { word: 'synthesis',    definition: 'Combining information from different sources',               vietnamese: 'tổng hợp',         collocations: ['literature synthesis', 'critical synthesis'],   example: 'A good essay synthesises multiple perspectives.' },
      { word: 'variable',     definition: 'An element that may change in an experiment',               vietnamese: 'biến số',          collocations: ['independent variable', 'control variable'],     example: 'The experiment controlled for several variables.' },
      { word: 'validate',     definition: 'To check the accuracy of something',                        vietnamese: 'kiểm chứng',       collocations: ['validate findings', 'validate a model'],        example: 'The results were validated by a second study.' },
      { word: 'scrutinize',   definition: 'To examine or inspect closely',                             vietnamese: 'xem xét kỹ lưỡng', collocations: ['scrutinize data', 'scrutinize claims'],        example: 'We need to scrutinize the methodology carefully.' },
    ],
    C1: [
      { word: 'epistemology',  definition: 'The branch of philosophy concerning knowledge',            vietnamese: 'nhận thức luận',   collocations: ['epistemological question', 'epistemology of science'], example: 'The course covers epistemology and logic.' },
      { word: 'heuristic',     definition: 'A practical approach to problem-solving without guarantees', vietnamese: 'phương pháp thử nghiệm', collocations: ['heuristic method', 'use heuristics'],     example: 'Heuristic methods speed up the search process.' },
      { word: 'postulate',     definition: 'To suggest or assume as fact; a basic principle',          vietnamese: 'giả định, tiên đề', collocations: ['postulate a theory', 'basic postulate'],        example: 'Einstein postulated that energy equals mass times c².' },
      { word: 'reflexivity',   definition: 'The researcher\'s awareness of their own influence',       vietnamese: 'tính phản thân',   collocations: ['researcher reflexivity', 'critical reflexivity'], example: 'Reflexivity is important in qualitative research.' },
      { word: 'seminal',       definition: 'Strongly influencing later developments',                  vietnamese: 'có tính khai phá', collocations: ['seminal work', 'seminal paper'],                 example: 'Darwin\'s Origin of Species is a seminal work.' },
      { word: 'triangulation', definition: 'Using multiple methods to study the same phenomenon',      vietnamese: 'tam giác hóa',     collocations: ['methodological triangulation', 'data triangulation'], example: 'Triangulation strengthens the validity of findings.' },
      { word: 'deductive',     definition: 'Reaching a specific conclusion from general principles',   vietnamese: 'suy diễn',         collocations: ['deductive reasoning', 'deductive approach'],    example: 'Deductive reasoning moves from theory to data.' },
      { word: 'inductive',     definition: 'Drawing general conclusions from specific observations',   vietnamese: 'quy nạp',          collocations: ['inductive reasoning', 'inductive logic'],       example: 'Inductive reasoning builds theory from observation.' },
      { word: 'longitudinal',  definition: 'Involving data collected over a long period',              vietnamese: 'nghiên cứu dọc',   collocations: ['longitudinal study', 'longitudinal data'],      example: 'The longitudinal study followed participants for 20 years.' },
      { word: 'normative',     definition: 'Relating to or establishing a standard or norm',           vietnamese: 'quy chuẩn',        collocations: ['normative statement', 'normative theory'],      example: 'The paper makes a normative claim about justice.' },
      { word: 'qualitative',   definition: 'Relating to quality and non-numerical data',               vietnamese: 'định tính',        collocations: ['qualitative research', 'qualitative data'],     example: 'Qualitative research captures lived experiences.' },
      { word: 'quantitative',  definition: 'Relating to quantity and measurable data',                 vietnamese: 'định lượng',       collocations: ['quantitative analysis', 'quantitative data'],   example: 'Quantitative studies use statistical methods.' },
      { word: 'abstraction',   definition: 'The process of forming a general concept from specific cases', vietnamese: 'trừu tượng hóa', collocations: ['level of abstraction', 'theoretical abstraction'], example: 'Philosophy requires a high degree of abstraction.' },
      { word: 'annotation',    definition: 'A note of explanation added to a text',                   vietnamese: 'chú thích',        collocations: ['add annotation', 'annotated bibliography'],     example: 'The professor asked students to write annotations.' },
      { word: 'ontological',   definition: 'Relating to the nature of being or existence',             vietnamese: 'bản thể luận',     collocations: ['ontological question', 'ontological assumption'], example: 'The debate raised ontological questions about identity.' },
    ],
    C2: [
      { word: 'axiom',           definition: 'A statement accepted as true without proof',            vietnamese: 'tiên đề',            collocations: ['mathematical axiom', 'logical axiom'],           example: 'Self-evident truths are treated as axioms in logic.' },
      { word: 'dialectic',       definition: 'The investigation of truth through reasoned argument',  vietnamese: 'phép biện chứng',    collocations: ['Hegelian dialectic', 'dialectical method'],      example: 'The dialectic between thesis and antithesis produces synthesis.' },
      { word: 'hermeneutic',     definition: 'Relating to interpretation, especially of texts',       vietnamese: 'phép diễn giải',     collocations: ['hermeneutic circle', 'hermeneutic approach'],    example: 'Hermeneutic analysis focuses on meaning in context.' },
      { word: 'juxtapose',       definition: 'To place side by side for comparison',                  vietnamese: 'đặt cạnh nhau để so sánh', collocations: ['juxtapose ideas', 'juxtapose images'],      example: 'The author juxtaposes poverty and wealth in the novel.' },
      { word: 'positivism',      definition: 'The belief that knowledge comes from observable facts', vietnamese: 'chủ nghĩa thực chứng', collocations: ['logical positivism', 'positivist approach'],   example: 'Positivism underpins many scientific research traditions.' },
      { word: 'reductionism',    definition: 'Analysing complex things by breaking them into parts',  vietnamese: 'chủ nghĩa quy giản', collocations: ['scientific reductionism', 'methodological reductionism'], example: 'Critics argue that reductionism oversimplifies behaviour.' },
      { word: 'tautology',       definition: 'Saying the same thing twice in different words',        vietnamese: 'đồng nghĩa luận',    collocations: ['circular tautology', 'avoid tautology'],         example: 'The argument is a tautology and proves nothing.' },
      { word: 'teleological',    definition: 'Relating to purpose or design in nature or events',     vietnamese: 'mục đích luận',      collocations: ['teleological argument', 'teleological view'],    example: 'Aristotle\'s teleological ethics links virtue to happiness.' },
      { word: 'verisimilitude',  definition: 'The appearance of being true or real',                  vietnamese: 'vẻ xác thực',        collocations: ['narrative verisimilitude', 'sense of verisimilitude'], example: 'The novel achieves great verisimilitude in its detail.' },
      { word: 'aphorism',        definition: 'A concise observation expressing a general truth',      vietnamese: 'câu châm ngôn',      collocations: ['philosophical aphorism', 'memorable aphorism'],  example: '"Know thyself" is a famous Socratic aphorism.' },
      { word: 'didactic',        definition: 'Intended to teach, esp. with a moral message',          vietnamese: 'có tính giáo huấn',  collocations: ['didactic literature', 'overly didactic'],        example: 'The poem has a didactic purpose, teaching moral lessons.' },
      { word: 'exegesis',        definition: 'Critical explanation or interpretation of a text',      vietnamese: 'giải thích văn bản', collocations: ['biblical exegesis', 'critical exegesis'],        example: 'The scholar provided a detailed exegesis of the passage.' },
      { word: 'solipsism',       definition: 'The view that only one\'s own mind can be known to exist', vietnamese: 'chủ nghĩa duy ngã', collocations: ['philosophical solipsism', 'extreme solipsism'],  example: 'Solipsism raises questions about the reality of others.' },
      { word: 'phenomenological',definition: 'Relating to conscious experience and perception',       vietnamese: 'hiện tượng luận',    collocations: ['phenomenological approach', 'phenomenological study'], example: 'Phenomenological research explores lived experience.' },
      { word: 'apologia',        definition: 'A formal written defence of one\'s beliefs or actions', vietnamese: 'bài biện hộ',        collocations: ['write an apologia', 'personal apologia'],        example: 'The essay reads as an apologia for his controversial views.' },
    ],
  },
  'Technology': {
    B1: [
      { word: 'device',     definition: 'A piece of equipment made for a specific purpose',            vietnamese: 'thiết bị',         collocations: ['mobile device', 'smart device'],               example: 'She uses several devices to stay connected.' },
      { word: 'software',   definition: 'Programs and operating information used by a computer',       vietnamese: 'phần mềm',         collocations: ['software update', 'install software'],         example: 'Make sure your software is up to date.' },
      { word: 'download',   definition: 'To transfer data from the internet to your computer',         vietnamese: 'tải xuống',        collocations: ['download a file', 'free download'],            example: 'He downloaded the app from the official store.' },
      { word: 'upload',     definition: 'To transfer data from your device to the internet',           vietnamese: 'tải lên',          collocations: ['upload a photo', 'upload speed'],              example: 'She uploaded her assignment to the portal.' },
      { word: 'digital',    definition: 'Relating to electronic technology using binary code',         vietnamese: 'kỹ thuật số',      collocations: ['digital media', 'go digital'],                 example: 'Most newspapers have gone digital.' },
      { word: 'program',    definition: 'A set of instructions for a computer to execute',             vietnamese: 'chương trình',     collocations: ['computer program', 'run a program'],           example: 'He wrote a program to automate the task.' },
      { word: 'data',       definition: 'Facts and information stored or processed by a computer',     vietnamese: 'dữ liệu',          collocations: ['store data', 'data breach'],                   example: 'The app collects user data to improve performance.' },
      { word: 'connect',    definition: 'To link together electronically',                              vietnamese: 'kết nối',          collocations: ['connect to Wi-Fi', 'connect devices'],         example: 'Please connect your laptop to the projector.' },
      { word: 'search',     definition: 'To look for information using a search engine',               vietnamese: 'tìm kiếm',         collocations: ['search engine', 'search online'],              example: 'I searched for the answer on Google.' },
      { word: 'keyboard',   definition: 'An input device with keys for typing',                        vietnamese: 'bàn phím',         collocations: ['keyboard shortcut', 'wireless keyboard'],      example: 'She typed the report using a wireless keyboard.' },
      { word: 'screen',     definition: 'The display surface of a computer or phone',                  vietnamese: 'màn hình',         collocations: ['touch screen', 'screen time'],                  example: 'The phone has a large high-resolution screen.' },
      { word: 'battery',    definition: 'A device that stores electrical energy',                      vietnamese: 'pin',              collocations: ['battery life', 'charge the battery'],           example: 'The battery life on this laptop is impressive.' },
      { word: 'wireless',   definition: 'Using radio waves rather than physical cables',               vietnamese: 'không dây',        collocations: ['wireless network', 'wireless charger'],         example: 'The office uses a wireless network for connectivity.' },
      { word: 'internet',   definition: 'The global network connecting computers worldwide',            vietnamese: 'internet',         collocations: ['internet connection', 'internet access'],       example: 'Fast internet access is now essential for work.' },
      { word: 'update',     definition: 'A new version of software fixing issues or adding features',  vietnamese: 'cập nhật',         collocations: ['software update', 'security update'],           example: 'Install the update to protect against security threats.' },
    ],
    B2: [
      { word: 'algorithm',    definition: 'A set of rules for solving a problem, esp. by computer',   vietnamese: 'thuật toán',          collocations: ['search algorithm', 'machine learning algorithm'], example: 'The algorithm recommends content based on your history.' },
      { word: 'bandwidth',    definition: 'The maximum rate of data transfer across a network',        vietnamese: 'băng thông',          collocations: ['high bandwidth', 'bandwidth limit'],             example: 'Video streaming requires high bandwidth.' },
      { word: 'cybersecurity',definition: 'Protection of computer systems from digital attacks',       vietnamese: 'an ninh mạng',        collocations: ['cybersecurity threat', 'cybersecurity expert'],  example: 'Cybersecurity is a growing concern for businesses.' },
      { word: 'database',     definition: 'A structured set of data held in a computer',               vietnamese: 'cơ sở dữ liệu',      collocations: ['database management', 'access the database'],    example: 'The hospital uses a database to store patient records.' },
      { word: 'encryption',   definition: 'Converting data into a code to prevent unauthorised access', vietnamese: 'mã hóa',             collocations: ['data encryption', 'end-to-end encryption'],      example: 'Messages are protected by end-to-end encryption.' },
      { word: 'infrastructure',definition: 'The basic systems supporting a network or organisation',  vietnamese: 'cơ sở hạ tầng',      collocations: ['IT infrastructure', 'digital infrastructure'],    example: 'Upgrading the IT infrastructure is a priority.' },
      { word: 'interface',    definition: 'A point where two systems or users interact',               vietnamese: 'giao diện',           collocations: ['user interface', 'graphical interface'],         example: 'The new user interface is much more intuitive.' },
      { word: 'malware',      definition: 'Software designed to disrupt or damage a computer system',  vietnamese: 'phần mềm độc hại',    collocations: ['install malware', 'malware attack'],             example: 'The malware infected thousands of computers.' },
      { word: 'network',      definition: 'A system of interconnected computers or devices',           vietnamese: 'mạng lưới',           collocations: ['computer network', 'social network'],            example: 'The company operates a global network of servers.' },
      { word: 'prototype',    definition: 'A first model of a device from which others are developed', vietnamese: 'nguyên mẫu',          collocations: ['build a prototype', 'test a prototype'],         example: 'Engineers built a prototype of the new robot.' },
      { word: 'simulate',     definition: 'To imitate a process using a computer model',               vietnamese: 'mô phỏng',            collocations: ['simulate conditions', 'computer simulation'],    example: 'The program simulates real-world driving conditions.' },
      { word: 'automate',     definition: 'To use technology to perform tasks without human effort',   vietnamese: 'tự động hóa',         collocations: ['automate a process', 'fully automated'],         example: 'The factory automated most of its production line.' },
      { word: 'deploy',       definition: 'To bring into effective action; to release software',       vietnamese: 'triển khai',           collocations: ['deploy an app', 'deploy to production'],         example: 'The team deployed the new version on Friday.' },
      { word: 'integrate',    definition: 'To combine different systems into a unified whole',          vietnamese: 'tích hợp',            collocations: ['integrate systems', 'seamlessly integrate'],     example: 'The new tool integrates with existing platforms.' },
      { word: 'streamline',   definition: 'To make a process simpler and more efficient',              vietnamese: 'hợp lý hóa',          collocations: ['streamline operations', 'streamline workflow'],  example: 'The software streamlines administrative tasks.' },
    ],
    C1: [
      { word: 'blockchain',        definition: 'A decentralised digital ledger of transactions',      vietnamese: 'chuỗi khối',           collocations: ['blockchain technology', 'public blockchain'],    example: 'Blockchain ensures transparent transaction records.' },
      { word: 'scalability',       definition: 'The ability of a system to handle growing demand',    vietnamese: 'khả năng mở rộng',     collocations: ['system scalability', 'horizontal scalability'],  example: 'Scalability is key for cloud-based applications.' },
      { word: 'virtualization',    definition: 'Creating a virtual version of a device or resource',  vietnamese: 'ảo hóa',               collocations: ['server virtualization', 'storage virtualization'], example: 'Virtualization reduces the need for physical servers.' },
      { word: 'machine learning',  definition: 'AI that enables computers to learn from data',        vietnamese: 'học máy',              collocations: ['machine learning model', 'apply machine learning'], example: 'Machine learning powers recommendation systems.' },
      { word: 'latency',           definition: 'The delay before data transfer begins',               vietnamese: 'độ trễ',               collocations: ['low latency', 'network latency'],                example: 'Gaming requires low latency connections.' },
      { word: 'throughput',        definition: 'The rate at which data is processed or transferred',  vietnamese: 'thông lượng',          collocations: ['high throughput', 'network throughput'],         example: 'The server\'s throughput increased after optimisation.' },
      { word: 'authentication',    definition: 'The process of verifying a user\'s identity',         vietnamese: 'xác thực',             collocations: ['two-factor authentication', 'user authentication'], example: 'Two-factor authentication adds an extra security layer.' },
      { word: 'agile',             definition: 'A flexible approach to software development',         vietnamese: 'phát triển linh hoạt', collocations: ['agile methodology', 'agile team'],               example: 'The team uses agile sprints to deliver features quickly.' },
      { word: 'microservices',     definition: 'An architecture of small, independent services',      vietnamese: 'vi dịch vụ',           collocations: ['microservices architecture', 'build microservices'], example: 'Microservices allow teams to deploy independently.' },
      { word: 'redundancy',        definition: 'Duplication of components to increase reliability',   vietnamese: 'dự phòng',             collocations: ['data redundancy', 'build in redundancy'],        example: 'Redundancy ensures the system stays online during failures.' },
      { word: 'tokenize',          definition: 'To convert sensitive data into a non-sensitive token', vietnamese: 'mã hóa thành token',  collocations: ['tokenize data', 'payment tokenization'],         example: 'Credit card numbers are tokenized for security.' },
      { word: 'payload',           definition: 'The data carried in a network transmission',          vietnamese: 'dữ liệu truyền tải',  collocations: ['request payload', 'JSON payload'],               example: 'The API accepts a JSON payload for each request.' },
      { word: 'API',               definition: 'A set of protocols for building software applications', vietnamese: 'giao diện lập trình ứng dụng', collocations: ['REST API', 'call an API'],           example: 'The developer used an API to fetch weather data.' },
      { word: 'containerization',  definition: 'Packaging software in isolated, portable containers', vietnamese: 'đóng gói container',  collocations: ['Docker containerization', 'container deployment'], example: 'Containerization makes apps portable across environments.' },
      { word: 'cloud computing',   definition: 'Storing and processing data on remote internet servers', vietnamese: 'điện toán đám mây', collocations: ['cloud computing service', 'move to the cloud'],  example: 'Many businesses rely on cloud computing for storage.' },
    ],
    C2: [
      { word: 'cryptography',      definition: 'The art of writing and solving codes',                vietnamese: 'mật mã học',           collocations: ['public-key cryptography', 'cryptographic protocol'], example: 'Modern cryptography secures online communications.' },
      { word: 'neural network',    definition: 'A computing system modelled on the brain',            vietnamese: 'mạng thần kinh nhân tạo', collocations: ['deep neural network', 'train a neural network'], example: 'The neural network learned to recognise speech.' },
      { word: 'quantum computing', definition: 'Computing using quantum-mechanical phenomena',         vietnamese: 'máy tính lượng tử',    collocations: ['quantum computing breakthrough', 'quantum algorithm'], example: 'Quantum computing could break current encryption.' },
      { word: 'zero-day exploit',  definition: 'An attack using an unknown software vulnerability',   vietnamese: 'khai thác lỗ hổng ngày không', collocations: ['zero-day vulnerability', 'patch a zero-day'], example: 'Hackers used a zero-day exploit to breach the system.' },
      { word: 'obfuscation',       definition: 'Making something unclear or hard to understand',      vietnamese: 'làm rối mã nguồn',     collocations: ['code obfuscation', 'data obfuscation'],          example: 'Obfuscation hides the logic of the source code.' },
      { word: 'polymorphic',       definition: 'Able to take many forms, esp. malware that changes',  vietnamese: 'đa hình thái',         collocations: ['polymorphic malware', 'polymorphic code'],       example: 'Polymorphic viruses evade detection by changing form.' },
      { word: 'hypervisor',        definition: 'Software that creates and runs virtual machines',     vietnamese: 'phần mềm ảo hóa hệ thống', collocations: ['hypervisor software', 'Type 1 hypervisor'],  example: 'The hypervisor manages multiple virtual machines.' },
      { word: 'immutable',         definition: 'Unchangeable once created (data or infrastructure)',  vietnamese: 'bất biến',             collocations: ['immutable data', 'immutable infrastructure'],    example: 'Blockchain records are immutable and tamper-proof.' },
      { word: 'sharding',          definition: 'Splitting a database into smaller distributed parts', vietnamese: 'phân mảnh cơ sở dữ liệu', collocations: ['database sharding', 'horizontal sharding'],   example: 'Sharding improves performance on large databases.' },
      { word: 'orchestration',     definition: 'Automated configuration and management of systems',   vietnamese: 'điều phối hệ thống',   collocations: ['container orchestration', 'Kubernetes orchestration'], example: 'Kubernetes handles container orchestration at scale.' },
      { word: 'idempotent',        definition: 'Producing the same result regardless of how often applied', vietnamese: 'bất biến lặp lại', collocations: ['idempotent operation', 'idempotent API'],      example: 'A DELETE request should be idempotent.' },
      { word: 'Byzantine fault',   definition: 'A failure where components give conflicting information', vietnamese: 'lỗi Byzantine',      collocations: ['Byzantine fault tolerance', 'Byzantine failure'],  example: 'Distributed systems must handle Byzantine faults.' },
      { word: 'deterministic',     definition: 'Producing a predictable output for a given input',    vietnamese: 'tất định',             collocations: ['deterministic algorithm', 'deterministic system'], example: 'Cryptographic hash functions are deterministic.' },
      { word: 'adversarial AI',    definition: 'Techniques to fool AI models with manipulated inputs', vietnamese: 'AI đối nghịch',       collocations: ['adversarial attack', 'adversarial example'],     example: 'Adversarial AI can trick image classifiers.' },
      { word: 'distributed ledger',definition: 'A database spread across multiple sites or institutions', vietnamese: 'sổ cái phân tán',   collocations: ['distributed ledger technology', 'public ledger'],  example: 'Blockchain is the most well-known distributed ledger.' },
    ],
  },
  'Environment': {
    B1: [
      { word: 'recycle',    definition: 'To convert waste into reusable material',                     vietnamese: 'tái chế',         collocations: ['recycle plastic', 'recycle waste'],            example: 'We should recycle glass, paper, and plastic.' },
      { word: 'pollute',    definition: 'To contaminate the environment with harmful substances',       vietnamese: 'ô nhiễm',         collocations: ['pollute the air', 'pollute rivers'],           example: 'Factories pollute the air with toxic gases.' },
      { word: 'climate',    definition: 'The long-term weather conditions in an area',                  vietnamese: 'khí hậu',         collocations: ['climate change', 'climate crisis'],            example: 'Climate change is one of the biggest global threats.' },
      { word: 'waste',      definition: 'Material that is no longer wanted and must be disposed of',   vietnamese: 'rác thải',        collocations: ['reduce waste', 'toxic waste'],                  example: 'We need to reduce the amount of waste we produce.' },
      { word: 'energy',     definition: 'Power obtained from physical or chemical resources',          vietnamese: 'năng lượng',      collocations: ['renewable energy', 'save energy'],             example: 'Solar panels generate clean, renewable energy.' },
      { word: 'solar',      definition: 'Relating to or derived from the sun',                          vietnamese: 'mặt trời',        collocations: ['solar panel', 'solar energy'],                  example: 'Solar panels reduce dependence on fossil fuels.' },
      { word: 'forest',     definition: 'A large area covered with trees and undergrowth',              vietnamese: 'rừng',            collocations: ['tropical forest', 'protect forests'],           example: 'Forests absorb large amounts of carbon dioxide.' },
      { word: 'protect',    definition: 'To keep something safe from harm',                             vietnamese: 'bảo vệ',          collocations: ['protect the environment', 'protect wildlife'],  example: 'We must protect endangered species from extinction.' },
      { word: 'wildlife',   definition: 'Wild animals and plants in their natural habitat',             vietnamese: 'động thực vật hoang dã', collocations: ['protect wildlife', 'wildlife habitat'],    example: 'Deforestation destroys important wildlife habitats.' },
      { word: 'ocean',      definition: 'A very large body of salt water on Earth',                     vietnamese: 'đại dương',       collocations: ['ocean pollution', 'ocean temperature'],         example: 'Ocean temperatures are rising due to climate change.' },
      { word: 'emission',   definition: 'The release of gases into the atmosphere',                     vietnamese: 'khí thải',        collocations: ['carbon emission', 'reduce emissions'],          example: 'Cars are a major source of harmful emissions.' },
      { word: 'habitat',    definition: 'The natural home of a plant or animal species',                vietnamese: 'môi trường sống', collocations: ['natural habitat', 'destroy habitats'],          example: 'Wetlands are an important habitat for birds.' },
      { word: 'renewable',  definition: 'From a source that is naturally replenished',                  vietnamese: 'tái tạo',         collocations: ['renewable energy', 'renewable resource'],       example: 'Wind is a clean, renewable source of energy.' },
      { word: 'clean',      definition: 'Free from pollution or harmful substances',                    vietnamese: 'sạch',            collocations: ['clean energy', 'clean water'],                  example: 'Access to clean water is a basic human right.' },
      { word: 'nature',     definition: 'The physical world including plants, animals, and landscapes', vietnamese: 'thiên nhiên',    collocations: ['protect nature', 'in nature'],                   example: 'Spending time in nature reduces stress levels.' },
    ],
    B2: [
      { word: 'biodiversity', definition: 'Variety of plant and animal life in a habitat',             vietnamese: 'đa dạng sinh học',   collocations: ['protect biodiversity', 'loss of biodiversity'],  example: 'Rainforests have extraordinary biodiversity.' },
      { word: 'deforestation',definition: 'Clearing large areas of forest',                             vietnamese: 'phá rừng',           collocations: ['rapid deforestation', 'combat deforestation'],   example: 'Deforestation contributes significantly to climate change.' },
      { word: 'greenhouse gas',definition: 'A gas that traps heat in the atmosphere',                  vietnamese: 'khí nhà kính',       collocations: ['reduce greenhouse gases', 'greenhouse effect'],  example: 'Carbon dioxide is the main greenhouse gas.' },
      { word: 'sustainability',definition: 'Meeting present needs without compromising the future',     vietnamese: 'bền vững',           collocations: ['environmental sustainability', 'sustainable development'], example: 'Sustainability is central to modern business strategy.' },
      { word: 'contaminate',  definition: 'To make something impure or harmful',                       vietnamese: 'làm ô nhiễm',        collocations: ['contaminate water', 'contaminate soil'],         example: 'Industrial waste contaminated the nearby river.' },
      { word: 'ecosystem',    definition: 'A community of organisms interacting in an environment',    vietnamese: 'hệ sinh thái',       collocations: ['fragile ecosystem', 'damage the ecosystem'],     example: 'Coral reefs are complex and fragile ecosystems.' },
      { word: 'fossil fuel',  definition: 'Fuel formed from ancient organisms (coal, oil, gas)',       vietnamese: 'nhiên liệu hóa thạch', collocations: ['burn fossil fuels', 'fossil fuel dependency'],  example: 'Burning fossil fuels is the main cause of global warming.' },
      { word: 'carbon footprint', definition: 'Total greenhouse gases produced by an individual',      vietnamese: 'dấu chân carbon',    collocations: ['reduce carbon footprint', 'calculate footprint'], example: 'Flying regularly increases your carbon footprint.' },
      { word: 'conservation', definition: 'Preservation and protection of natural environments',        vietnamese: 'bảo tồn',            collocations: ['wildlife conservation', 'conservation effort'],  example: 'Conservation efforts have helped save some species.' },
      { word: 'drought',      definition: 'A prolonged period of abnormally low rainfall',              vietnamese: 'hạn hán',            collocations: ['severe drought', 'drought conditions'],          example: 'The drought devastated crops across the region.' },
      { word: 'flood',        definition: 'An overflow of water onto land that is usually dry',         vietnamese: 'lũ lụt',             collocations: ['flash flood', 'flood damage'],                   example: 'Heavy floods displaced thousands of families.' },
      { word: 'landfill',     definition: 'A site for the disposal of waste materials by burial',       vietnamese: 'bãi rác',            collocations: ['landfill site', 'send to landfill'],             example: 'Reducing landfill waste is a key environmental goal.' },
      { word: 'pesticide',    definition: 'A chemical used to kill insects or other organisms',         vietnamese: 'thuốc trừ sâu',      collocations: ['use pesticides', 'pesticide-free farming'],      example: 'Excessive pesticide use harms local bee populations.' },
      { word: 'erosion',      definition: 'Gradual destruction of soil or land by wind or water',       vietnamese: 'xói mòn',            collocations: ['soil erosion', 'coastal erosion'],               example: 'Soil erosion reduces agricultural productivity.' },
      { word: 'ozone',        definition: 'A gas in the atmosphere protecting Earth from UV radiation', vietnamese: 'ôzôn',               collocations: ['ozone layer', 'ozone depletion'],                example: 'Ozone depletion increases skin cancer risk.' },
    ],
    C1: [
      { word: 'anthropogenic', definition: 'Caused or produced by human activity',                     vietnamese: 'do con người gây ra', collocations: ['anthropogenic climate change', 'anthropogenic factors'], example: 'Most scientists agree that warming is anthropogenic.' },
      { word: 'desertification',definition: 'The process by which fertile land becomes desert',        vietnamese: 'sa mạc hóa',          collocations: ['prevent desertification', 'risk of desertification'], example: 'Overgrazing accelerates desertification in arid regions.' },
      { word: 'eutrophication', definition: 'Excess nutrients causing dense plant growth and oxygen loss', vietnamese: 'phú dưỡng hóa',    collocations: ['lake eutrophication', 'coastal eutrophication'],  example: 'Agricultural runoff leads to eutrophication of lakes.' },
      { word: 'mitigation',    definition: 'Actions to reduce the severity of climate change',         vietnamese: 'giảm thiểu',          collocations: ['climate mitigation', 'mitigation strategy'],     example: 'Planting trees is one mitigation strategy.' },
      { word: 'sequestration', definition: 'Capturing and storing carbon dioxide from the atmosphere', vietnamese: 'cô lập carbon',       collocations: ['carbon sequestration', 'forest sequestration'],  example: 'Forests are vital for carbon sequestration.' },
      { word: 'reforestation', definition: 'Replanting trees in deforested areas',                     vietnamese: 'tái trồng rừng',      collocations: ['reforestation project', 'large-scale reforestation'], example: 'Reforestation programmes help restore biodiversity.' },
      { word: 'geothermal',    definition: 'Relating to heat generated within the Earth',              vietnamese: 'địa nhiệt',           collocations: ['geothermal energy', 'geothermal power plant'],   example: 'Iceland relies heavily on geothermal energy.' },
      { word: 'photovoltaic',  definition: 'Relating to the conversion of light into electricity',     vietnamese: 'quang điện',          collocations: ['photovoltaic cell', 'photovoltaic panel'],       example: 'Photovoltaic panels convert sunlight directly to power.' },
      { word: 'biomass',       definition: 'Organic matter used as fuel',                              vietnamese: 'sinh khối',           collocations: ['biomass energy', 'biomass fuel'],                example: 'Biomass can be converted into biofuel.' },
      { word: 'symbiosis',     definition: 'A mutually beneficial relationship between two species',   vietnamese: 'cộng sinh',           collocations: ['ecological symbiosis', 'mutualistic symbiosis'],  example: 'Bees and flowers share a symbiotic relationship.' },
      { word: 'watershed',     definition: 'An area of land draining into a river; a turning point',  vietnamese: 'lưu vực sông',        collocations: ['watershed management', 'watershed area'],        example: 'Protecting the watershed prevents flooding downstream.' },
      { word: 'resilience',    definition: 'The ability of an ecosystem to recover from disturbance',  vietnamese: 'khả năng phục hồi',   collocations: ['ecological resilience', 'build resilience'],     example: 'Diverse ecosystems have greater resilience.' },
      { word: 'tectonic',      definition: 'Relating to the structure of the Earth\'s crust',         vietnamese: 'kiến tạo địa chất',   collocations: ['tectonic plate', 'tectonic activity'],           example: 'Tectonic activity causes earthquakes and volcanoes.' },
      { word: 'thermodynamics',definition: 'The science of heat and energy conversion',                vietnamese: 'nhiệt động lực học',  collocations: ['laws of thermodynamics', 'thermodynamic process'], example: 'Thermodynamics explains energy transfer in ecosystems.' },
      { word: 'biosphere',     definition: 'The part of Earth where living organisms exist',           vietnamese: 'sinh quyển',          collocations: ['global biosphere', 'biosphere reserve'],         example: 'Human activity is altering the biosphere rapidly.' },
    ],
    C2: [
      { word: 'acidification',  definition: 'Decrease in pH of oceans due to absorbed CO2',           vietnamese: 'axit hóa',            collocations: ['ocean acidification', 'soil acidification'],     example: 'Ocean acidification is destroying coral reef structures.' },
      { word: 'anthropocene',   definition: 'The current geological age defined by human influence',  vietnamese: 'kỷ Nhân Sinh',        collocations: ['Anthropocene era', 'living in the Anthropocene'], example: 'The Anthropocene marks humanity\'s planetary impact.' },
      { word: 'bioaccumulation',definition: 'Build-up of toxic substances in an organism over time',  vietnamese: 'tích lũy sinh học',   collocations: ['bioaccumulation of toxins', 'bioaccumulation in fish'], example: 'Mercury bioaccumulation endangers top predators.' },
      { word: 'cryosphere',     definition: 'Parts of Earth\'s surface where water is frozen',        vietnamese: 'băng quyển',          collocations: ['cryosphere melting', 'Arctic cryosphere'],       example: 'Cryosphere melting raises global sea levels.' },
      { word: 'geoengineering', definition: 'Large-scale technological intervention in Earth\'s systems', vietnamese: 'kỹ thuật địa cầu', collocations: ['solar geoengineering', 'climate geoengineering'], example: 'Geoengineering proposals remain controversial.' },
      { word: 'ecotoxicology',  definition: 'The study of toxic effects on ecosystems',               vietnamese: 'độc học sinh thái',   collocations: ['ecotoxicology study', 'field of ecotoxicology'], example: 'Ecotoxicology examines how pollutants affect wildlife.' },
      { word: 'pedosphere',     definition: 'The outermost layer of Earth that supports soil',        vietnamese: 'thổ nhưỡng quyển',    collocations: ['pedosphere health', 'pedosphere carbon'],        example: 'Soil degradation threatens the entire pedosphere.' },
      { word: 'phytoplankton',  definition: 'Microscopic marine plants that produce much of Earth\'s oxygen', vietnamese: 'thực vật phù du', collocations: ['phytoplankton bloom', 'phytoplankton decline'],  example: 'Phytoplankton produce about half of Earth\'s oxygen.' },
      { word: 'lithosphere',    definition: 'The rigid outer part of the Earth including the crust',  vietnamese: 'thạch quyển',         collocations: ['lithosphere plate', 'lithosphere movement'],     example: 'The lithosphere is divided into tectonic plates.' },
      { word: 'mesosphere',     definition: 'The layer of Earth\'s atmosphere above the stratosphere', vietnamese: 'trung quyển',        collocations: ['mesosphere temperature', 'upper mesosphere'],    example: 'Meteors burn up when they enter the mesosphere.' },
      { word: 'radiative forcing', definition: 'The change in energy flux caused by a climate driver', vietnamese: 'cưỡng bức bức xạ', collocations: ['positive radiative forcing', 'radiative forcing value'], example: 'CO2 has a strong positive radiative forcing effect.' },
      { word: 'thermocline',    definition: 'A layer of water where temperature drops sharply',       vietnamese: 'lớp nhiệt nhảy vọt', collocations: ['ocean thermocline', 'thermocline depth'],         example: 'Nutrients rise to the surface through the thermocline.' },
      { word: 'xerophyte',      definition: 'A plant adapted to survive in dry conditions',            vietnamese: 'thực vật chịu hạn',  collocations: ['desert xerophyte', 'xerophyte adaptation'],      example: 'Cacti are classic examples of xerophytes.' },
      { word: 'halogen',        definition: 'A group of elements forming salts with metals',           vietnamese: 'halogen',             collocations: ['halogen compound', 'halogen gas'],               example: 'CFCs are halogen compounds that destroy the ozone layer.' },
      { word: 'heterotroph',    definition: 'An organism that cannot produce its own food',            vietnamese: 'sinh vật dị dưỡng', collocations: ['heterotroph consumer', 'heterotrophic organism'],  example: 'All animals are heterotrophs that consume other organisms.' },
    ],
  },
};

/* ─── Vocabulary Learning State ─────────────────────────────────────────── */
let vocabTopic = 'General English';
let vocabLevel = 'B1';
let _vocabGameWords = [];
let _vocabGameIndex = 0;
let _vocabScore = 0;
let _vocabMatchSelected = null; // for matching game: { col, idx }
let _vocabMatchPaired = new Set();

/* ─── Init ───────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  // Restore dark mode preference
  if (localStorage.getItem('ielts_dark_mode') === '1') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('dark-mode-btn');
    if (btn) btn.textContent = '☀️';
  }

  // Restore sidebar collapsed state
  if (localStorage.getItem('ielts_sidebar_collapsed') === '1') {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    const showBtn = document.getElementById('sidebar-show-btn');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebar) sidebar.classList.add('sidebar-collapsed');
    if (main) main.classList.add('sidebar-collapsed');
    if (showBtn) showBtn.classList.remove('hidden');
    if (toggleBtn) toggleBtn.textContent = '›';
  }

  if (token && currentUser) {
    showApp();
  } else {
    show('auth-screen');
    hide('app-screen');
  }
});

// Warn on tab close / refresh when essay has content
window.addEventListener('beforeunload', (e) => {
  if (isOnSubmitWithContent()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (res.status === 401) {
    // Token expired or invalid — clear session and redirect to login
    token = null; currentUser = null;
    localStorage.removeItem('ielts_token');
    localStorage.removeItem('ielts_user');
    hide('app-screen');
    show('auth-screen');
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function bandColor(score) {
  if (!score) return '';
  if (score >= 8.5) return 'band-9';
  if (score >= 7.5) return 'band-8';
  if (score >= 6.5) return 'band-7';
  if (score >= 5.5) return 'band-6';
  if (score >= 4.5) return 'band-5';
  if (score >= 3.5) return 'band-4';
  return 'band-low';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusChip(status) {
  const map = { graded: 'Graded', grading: 'Grading…', pending: 'Pending', error: 'Error', pending_review: 'Awaiting Review' };
  const cssClass = status === 'pending_review' ? 'pending-review' : status;
  return `<span class="status-chip status-${cssClass}">${map[status] || status}</span>`;
}

/* ─── Auth ───────────────────────────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelector('.tab-bar').classList.remove('hidden');
  document.getElementById('forgot-form').classList.add('hidden');
  document.getElementById('reset-form').classList.add('hidden');
  document.getElementById('verify-form').classList.add('hidden');
}

// Show any one auth form, hiding all others
function showAuthForm(which) {
  const forms = ['login-form', 'register-form', 'forgot-form', 'reset-form', 'verify-form'];
  forms.forEach(id => document.getElementById(id).classList.add('hidden'));
  const tabBar = document.querySelector('.tab-bar');
  if (which === 'login' || which === 'register') {
    tabBar.classList.remove('hidden');
    document.getElementById(which + '-form').classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (which === 'login')));
  } else {
    tabBar.classList.add('hidden');
    document.getElementById(which + '-form').classList.remove('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
        remember_me: document.getElementById('remember-me').checked
      })
    });
    if (data.needsVerification) { showVerifyForm(data.email); return; }
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, password: document.getElementById('reg-password').value })
    });
    if (data.needsVerification) {
      showVerifyForm(data.email);
      if (data.emailSent === false) {
        const verifyErr = document.getElementById('verify-error');
        verifyErr.textContent = "⚠️ We couldn't send the verification code. Click \"Resend Code\" to try again.";
        verifyErr.classList.remove('hidden');
      }
      return;
    }
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function showVerifyForm(email) {
  pendingVerifyEmail = email;
  document.getElementById('verify-email-display').textContent = email;
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('verify-form').classList.remove('hidden');
  document.querySelector('.tab-bar').classList.add('hidden');
  document.getElementById('verify-code').value = '';
  document.getElementById('verify-error').classList.add('hidden');
  document.getElementById('verify-success').classList.add('hidden');
  document.getElementById('verify-code').focus();
}

async function handleVerify() {
  const errEl = document.getElementById('verify-error');
  const okEl = document.getElementById('verify-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const code = document.getElementById('verify-code').value.trim().replace(/\s/g, '');
  if (code.length !== 6) {
    errEl.textContent = 'Please enter the 6-digit code from your email.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const data = await api('/api/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: pendingVerifyEmail, code })
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleResendCode() {
  const errEl = document.getElementById('verify-error');
  const okEl = document.getElementById('verify-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  try {
    await api('/api/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: pendingVerifyEmail })
    });
    okEl.textContent = 'New code sent! Check your inbox (and spam folder).';
    okEl.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

/* ─── Forgot / Reset Password ────────────────────────────────────────────── */
function showForgotForm() {
  showAuthForm('forgot');
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-error').classList.add('hidden');
  document.getElementById('forgot-success').classList.add('hidden');
  document.getElementById('forgot-email').focus();
}

function showResetForm(email) {
  pendingResetEmail = email;
  document.getElementById('reset-email-display').textContent = email;
  showAuthForm('reset');
  document.getElementById('reset-code').value = '';
  document.getElementById('reset-new-password').value = '';
  document.getElementById('reset-confirm-password').value = '';
  document.getElementById('reset-error').classList.add('hidden');
  document.getElementById('reset-code').focus();
}

async function handleForgotPassword() {
  const errEl = document.getElementById('forgot-error');
  const okEl = document.getElementById('forgot-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { errEl.textContent = 'Please enter your email address.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (data.email) {
      showResetForm(data.email);
    } else {
      // User not found — still show success message to avoid enumeration
      okEl.textContent = 'If that email is registered, a reset code has been sent.';
      okEl.classList.remove('hidden');
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleResetPassword() {
  const errEl = document.getElementById('reset-error');
  errEl.classList.add('hidden');
  const code = document.getElementById('reset-code').value.trim();
  const newPw = document.getElementById('reset-new-password').value;
  const confirmPw = document.getElementById('reset-confirm-password').value;
  if (code.length !== 6) { errEl.textContent = 'Enter the 6-digit reset code.'; errEl.classList.remove('hidden'); return; }
  if (newPw.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (newPw !== confirmPw) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('/api/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: pendingResetEmail, code, new_password: newPw })
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function saveSession({ token: t, user }) {
  token = t;
  currentUser = user;
  localStorage.setItem('ielts_token', t);
  localStorage.setItem('ielts_user', JSON.stringify(user));
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('ielts_token');
  localStorage.removeItem('ielts_user');
  clearInterval(pollingInterval);
  hide('app-screen');
  show('auth-screen');
}

/* ─── App Shell ──────────────────────────────────────────────────────────── */
function applyUserToUI() {
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('welcome-name').textContent = currentUser.name.split(' ')[0];
  document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();

  // Role label in sidebar footer
  const roleLabelEl = document.getElementById('user-role-label');
  if (roleLabelEl) {
    const roleMap = { admin: '⚙️ Admin', teacher: '🎓 Teacher', student: '🎓 Student' };
    roleLabelEl.textContent = roleMap[currentUser.role] || currentUser.role;
  }

  // Show role-specific nav groups
  const adminNavGroup = document.getElementById('nav-group-admin');
  const teacherNavGroup = document.getElementById('nav-group-teacher');
  if (currentUser.role === 'admin') {
    adminNavGroup.classList.remove('hidden');
    if (teacherNavGroup) teacherNavGroup.classList.add('hidden');
  } else if (currentUser.role === 'teacher') {
    if (teacherNavGroup) teacherNavGroup.classList.remove('hidden');
    adminNavGroup.classList.add('hidden');
  } else {
    adminNavGroup.classList.add('hidden');
    if (teacherNavGroup) teacherNavGroup.classList.add('hidden');
  }

  // Load queue badge count for teacher/admin
  if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
    api('/api/admin/submissions/pending').then(items => updateQueueBadge(items.length)).catch(() => {});
  }

  // Show notification bell for students; start polling
  const bellBtn = document.getElementById('notif-bell-btn');
  if (currentUser.role === 'student') {
    if (bellBtn) bellBtn.classList.remove('hidden');
    pollNotifications();
  } else {
    if (bellBtn) bellBtn.classList.add('hidden');
    if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; }
  }
}

async function showApp() {
  hide('auth-screen');
  show('app-screen');

  // Render immediately with cached data so the screen appears fast
  applyUserToUI();

  // Then fetch fresh role/name from server — catches role changes made by admin
  // without requiring the user to log out and back in
  try {
    const fresh = await api('/api/user/profile');
    if (fresh.role && (fresh.role !== currentUser.role || fresh.name !== currentUser.name)) {
      currentUser.role = fresh.role;
      currentUser.name = fresh.name || currentUser.name;
      localStorage.setItem('ielts_user', JSON.stringify(currentUser));
      applyUserToUI(); // re-render nav with updated role
    }
  } catch (e) { /* network error — keep cached role */ }

  // Click-to-toggle nav groups (attach once; guard with data attribute)
  document.querySelectorAll('.nav-group-header').forEach(header => {
    if (header.dataset.toggleBound) return;
    header.dataset.toggleBound = '1';
    header.addEventListener('click', () => {
      header.closest('.nav-group').classList.toggle('open');
    });
  });

  showView('dashboard');
}

function isOnSubmitWithContent() {
  const submitView = document.getElementById('view-submit');
  if (!submitView || submitView.classList.contains('hidden')) return false;
  const essay = (document.getElementById('essay-text') || {}).value || '';
  return essay.trim().length > 0;
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  const isOpen = sidebar.classList.contains('sidebar-open');
  sidebar.classList.toggle('sidebar-open', !isOpen);
  backdrop.classList.toggle('active', !isOpen);
}

function showView(name) {
  // Auto-close sidebar on mobile after nav click
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  // Warn if navigating away from submit view with unsaved essay content
  if (name !== 'submit' && isOnSubmitWithContent()) {
    if (!confirm('You have an essay in progress. Leave without saving your draft?')) return;
  }
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  // Reset feedback back button to default when not coming from archive
  if (name !== 'feedback') {
    const backBtn = document.querySelector('#view-feedback .btn-back');
    if (backBtn) { backBtn.onclick = () => showView('history'); backBtn.textContent = '← Back'; }
  }
  show(`view-${name}`);
  const navEl = document.getElementById(`nav-${name}`);
  if (navEl) navEl.classList.add('active');

  // Test-taking view hides sidebar
  if (name === 'test-taking') {
    document.getElementById('app-screen').classList.add('test-mode');
  } else {
    document.getElementById('app-screen').classList.remove('test-mode');
  }

  if (name === 'dashboard') loadDashboard();
  else if (name === 'history') loadHistory();
  else if (name === 'submit') { _currentDraftId = null; updateTopicOptions(); loadDraftIfExists(); initPasteTracking(); }
  else if (name === 'admin') loadAdminUsers();
  else if (name === 'admin-materials') loadAdminMaterials();
  else if (name === 'admin-assignments') loadAdminAssignments();
  else if (name === 'grade-queue') loadGradeQueue();
  else if (name === 'submissions-archive') loadSubmissionsArchive();
  else if (name === 'admin-student-history') { /* loaded by viewStudentHistory() */ }
  else if (name === 'homework') loadHomework();
  else if (name === 'test-list') loadTestList();
  else if (name === 'test-history') loadTestHistory();
  else if (name === 'classes') loadClassList();
  else if (name === 'class-detail') { /* loaded by openClassDetail() */ }
  else if (name === 'my-attendance') loadMyAttendance();
  else if (name === 'vocab') loadVocabNotebook();
  else if (name === 'vocab-learn') loadVocabLearn();
  else if (name === 'speaking') loadSpeakingTopicGen();
  else if (name === 'change-password') {
    ['cp-current','cp-new','cp-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cp-error').classList.add('hidden');
    document.getElementById('cp-success').classList.add('hidden');
  }
}

/* ─── Admin Panel ────────────────────────────────────────────────────────── */
async function loadAdminUsers() {
  if (currentUser.role === 'admin') loadAdminCostBreakdown(); // admin-only panel
  const el = document.getElementById('admin-users-table');
  el.innerHTML = '<div class="loading">Loading users…</div>';
  try {
    const users = await api('/api/admin/users');
    if (!users.length) {
      el.innerHTML = '<div class="empty-state">No users registered yet.</div>';
      return;
    }
    const isAdmin = currentUser.role === 'admin';
    el.innerHTML = `
      ${isAdmin ? `
      <div class="batch-toolbar" id="batch-toolbar">
        <span class="batch-count" id="batch-count">0 selected</span>
        <div class="batch-actions">
          <button class="btn btn-xs btn-teacher" onclick="batchAction('set_role','teacher')">→ Teacher</button>
          <button class="btn btn-xs btn-secondary" onclick="batchAction('set_role','student')">→ Student</button>
          <button class="btn btn-xs btn-danger" onclick="batchAction('delete')">🗑 Delete</button>
        </div>
        <button class="btn btn-xs btn-secondary" onclick="clearBatchSelection()">✕ Clear</button>
      </div>` : ''}
      <div class="admin-table-wrap">
        <table class="admin-table" id="admin-users-tbl">
          <thead>
            <tr>
              ${isAdmin ? `<th><input type="checkbox" id="select-all-users" onchange="toggleSelectAllUsers(this)" title="Select all"></th>` : '<th>#</th>'}
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Verified</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Essays</th>
              <th>Avg Band</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u, i) => {
              const canAct = isAdmin && u.id !== currentUser.id && u.role !== 'admin';
              return `
              <tr data-uid="${u.id}">
                ${isAdmin ? `<td>${canAct ? `<input type="checkbox" class="user-select-cb" data-uid="${u.id}" onchange="onUserCheckChange()">` : ''}</td>` : `<td>${i + 1}</td>`}
                <td>${i + 1}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.verified
                  ? '<span class="badge badge-green">✓ Verified</span>'
                  : '<span class="badge badge-red">✗ Pending</span>'}</td>
                <td>
                  <span class="badge ${u.role === 'admin' ? 'badge-purple' : u.role === 'teacher' ? 'badge-teacher' : 'badge-gray'}">${u.role}</span>
                </td>
                <td>${formatDate(u.created_at)}</td>
                <td>${u.submission_count}</td>
                <td>${u.avg_band !== null ? u.avg_band : '—'}</td>
                <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  <button class="btn btn-secondary btn-xs" onclick="viewStudentHistory(${u.id}, '${u.name.replace(/'/g, "\\'")}')">View History</button>
                  ${canAct ? `
                    <button class="btn btn-xs ${u.role === 'teacher' ? 'btn-secondary' : 'btn-teacher'}"
                      onclick="setUserRole(${u.id}, '${u.role === 'teacher' ? 'student' : 'teacher'}', this)">
                      ${u.role === 'teacher' ? '→ Student' : '→ Teacher'}
                    </button>
                    <button class="btn btn-danger btn-xs" onclick="confirmDeleteUser(${u.id}, '${u.name.replace(/'/g, "\\'")}')">Delete</button>
                  ` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function getSelectedUserIds() {
  return [...document.querySelectorAll('.user-select-cb:checked')].map(cb => parseInt(cb.dataset.uid, 10));
}

function onUserCheckChange() {
  const ids = getSelectedUserIds();
  const toolbar = document.getElementById('batch-toolbar');
  const countEl = document.getElementById('batch-count');
  if (!toolbar || !countEl) return;
  countEl.textContent = `${ids.length} selected`;
  toolbar.classList.toggle('batch-toolbar-active', ids.length > 0);
}

function toggleSelectAllUsers(masterCb) {
  document.querySelectorAll('.user-select-cb').forEach(cb => cb.checked = masterCb.checked);
  onUserCheckChange();
}

function clearBatchSelection() {
  document.querySelectorAll('.user-select-cb').forEach(cb => cb.checked = false);
  const masterCb = document.getElementById('select-all-users');
  if (masterCb) masterCb.checked = false;
  onUserCheckChange();
}

async function batchAction(action, role) {
  const ids = getSelectedUserIds();
  if (!ids.length) return;
  const label = action === 'delete'
    ? `permanently delete ${ids.length} user(s)`
    : `set ${ids.length} user(s) to ${role}`;
  if (!confirm(`This will ${label}. Continue?`)) return;
  try {
    const result = await api('/api/admin/users/batch', {
      method: 'POST',
      body: JSON.stringify({ action, ids, role })
    });
    const msg = `Done: ${result.ok} updated${result.skipped ? `, ${result.skipped} skipped (admins/self)` : ''}.`;
    alert(msg);
    loadAdminUsers();
  } catch (err) {
    alert('Batch action failed: ' + err.message);
  }
}

async function viewStudentHistory(userId, userName) {
  // Switch to history view first so elements exist
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  show('view-admin-student-history');
  document.getElementById('admin-student-history-title').textContent = `${userName} — Submissions`;
  document.getElementById('admin-student-history-sub').textContent = 'Full essay history for AI/plagiarism review';
  const contentEl = document.getElementById('admin-student-history-content');
  contentEl.innerHTML = '<div class="loading">Loading submissions…</div>';

  try {
    const data = await api(`/api/admin/users/${userId}/submissions`);
    const subs = data.submissions;
    if (!subs.length) {
      contentEl.innerHTML = '<div class="empty-state">No submissions yet.</div>';
      return;
    }
    contentEl.innerHTML = subs.map(s => {
      const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
      const bandColor = s.overall_band >= 7 ? '#16a34a' : s.overall_band >= 5.5 ? '#d97706' : s.overall_band ? '#dc2626' : '#6b7280';

      // Paste analysis badge
      let pasteBadge = '';
      if (s.paste_stats) {
        const p = s.paste_stats;
        const total = p.total_pasted + p.total_typed;
        const pasteRatio = total > 0 ? p.total_pasted / total : 0;
        if (p.paste_count === 0) {
          pasteBadge = `<span class="paste-badge paste-clean" title="No paste events detected">✍️ Typed</span>`;
        } else if (pasteRatio > 0.7 || p.largest_paste > 300) {
          pasteBadge = `<span class="paste-badge paste-suspicious" title="${p.paste_count} paste event(s), largest: ${p.largest_paste} chars, ~${Math.round(pasteRatio*100)}% pasted">🚨 Mostly pasted (${p.paste_count} paste${p.paste_count>1?'s':''})</span>`;
        } else if (p.paste_count > 0) {
          pasteBadge = `<span class="paste-badge paste-mixed" title="${p.paste_count} paste event(s), largest: ${p.largest_paste} chars, ~${Math.round(pasteRatio*100)}% pasted">⚠️ Some pasting (${p.paste_count} paste${p.paste_count>1?'s':''})</span>`;
        }
      }

      // Existing comments
      const comments = s.comments || [];
      const commentsHtml = comments.length ? comments.map(c => `
        <div class="teacher-comment" id="tc-${s.id}-${c.id}">
          <div class="tc-meta">
            <span class="tc-author">💬 ${escHtml(c.teacher_name)}</span>
            <span class="tc-date">${formatDate(c.created_at)}</span>
            ${c.teacher_id === currentUser.id ? `<button class="btn-link tc-delete" onclick="deleteTeacherComment(${s.id},${c.id},this)">Delete</button>` : ''}
          </div>
          <div class="tc-text">${escHtml(c.text)}</div>
        </div>`).join('') : '';

      return `
        <div class="student-history-card" id="shc-${s.id}">
          <div class="student-history-header">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="submission-badge ${s.task_type === 'task1' ? 'badge-t1' : 'badge-t2'}" style="width:auto;padding:3px 10px">${taskLabel}</span>
              <span style="font-size:13px;color:var(--gray-500)">${s.word_count} words · ${formatDate(s.created_at)}</span>
              ${s.overall_band != null ? `<span style="font-weight:700;color:${bandColor}">Band ${s.overall_band}</span>` : `<span class="badge badge-gray">${s.status}</span>`}
              ${s.cost_usd ? `<span style="font-size:11px;color:var(--gray-400)">$${s.cost_usd.toFixed(4)}</span>` : ''}
              ${pasteBadge}
            </div>
            <button class="btn btn-secondary btn-xs" onclick="this.closest('.student-history-card').querySelector('.essay-full').classList.toggle('hidden');this.textContent=this.textContent==='Show Essay'?'Hide Essay':'Show Essay'">Show Essay</button>
          </div>
          <div class="student-history-prompt"><strong>Prompt:</strong> ${escHtml(s.prompt)}</div>
          <div class="essay-full hidden">
            <div class="essay-text-box">${escHtml(s.essay)}</div>
          </div>
          ${s.detailed_feedback ? `<div class="student-history-feedback"><strong>Feedback summary:</strong> ${escHtml(s.detailed_feedback.slice(0, 300))}${s.detailed_feedback.length > 300 ? '…' : ''}</div>` : ''}

          <div class="teacher-comments-section">
            ${commentsHtml}
            <div class="add-comment-row">
              <textarea class="add-comment-input" id="comment-input-${s.id}" rows="2" placeholder="Leave a comment for this student…"></textarea>
              <button class="btn btn-primary btn-sm" onclick="addTeacherComment(${s.id})">💬 Add Comment</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    contentEl.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

async function addTeacherComment(submissionId) {
  const input = document.getElementById(`comment-input-${submissionId}`);
  const text = input?.value.trim();
  if (!text) return;
  input.disabled = true;
  try {
    const comment = await api(`/api/admin/submissions/${submissionId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    input.value = '';
    // Inject the new comment above the input row
    const addRow = input.closest('.add-comment-row');
    const commentEl = document.createElement('div');
    commentEl.className = 'teacher-comment';
    commentEl.id = `tc-${submissionId}-${comment.id}`;
    commentEl.innerHTML = `
      <div class="tc-meta">
        <span class="tc-author">💬 ${escHtml(comment.teacher_name)}</span>
        <span class="tc-date">${formatDate(comment.created_at)}</span>
        <button class="btn-link tc-delete" onclick="deleteTeacherComment(${submissionId},${comment.id},this)">Delete</button>
      </div>
      <div class="tc-text">${escHtml(comment.text)}</div>`;
    addRow.parentNode.insertBefore(commentEl, addRow);
  } catch (err) {
    alert('Failed to add comment: ' + err.message);
  } finally {
    if (input) input.disabled = false;
  }
}

async function deleteTeacherComment(submissionId, commentId, btn) {
  if (!confirm('Delete this comment?')) return;
  try {
    await api(`/api/admin/submissions/${submissionId}/comments/${commentId}`, { method: 'DELETE' });
    document.getElementById(`tc-${submissionId}-${commentId}`)?.remove();
  } catch (err) {
    alert('Failed to delete comment: ' + err.message);
  }
}

async function confirmDeleteUser(userId, userName) {
  if (!confirm(`Delete user "${userName}"?\n\nThis will permanently remove their account, all submissions, and all feedback. This cannot be undone.`)) return;
  try {
    await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    loadAdminUsers(); // refresh table
  } catch (err) {
    alert('Failed to delete user: ' + err.message);
  }
}

async function setUserRole(userId, newRole, btn) {
  if (!confirm(`Change this user's role to "${newRole}"?`)) return;
  try {
    btn.disabled = true;
    btn.textContent = '…';
    await api(`/api/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
    loadAdminUsers(); // refresh table
  } catch (err) {
    btn.disabled = false;
    btn.textContent = newRole === 'teacher' ? '→ Teacher' : '→ Student';
    alert('Failed to change role: ' + err.message);
  }
}

/* ─── Change Password ────────────────────────────────────────────────────── */
async function handleChangePassword() {
  const errEl = document.getElementById('cp-error');
  const okEl = document.getElementById('cp-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const current = document.getElementById('cp-current').value;
  const newPw = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  if (!current) { errEl.textContent = 'Please enter your current password.'; errEl.classList.remove('hidden'); return; }
  if (newPw.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (newPw !== confirm) { errEl.textContent = 'New passwords do not match.'; errEl.classList.remove('hidden'); return; }
  try {
    await api('/api/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: newPw })
    });
    okEl.textContent = '✓ Password updated successfully!';
    okEl.classList.remove('hidden');
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const [submissions, profile, testAttempts] = await Promise.all([
      api('/api/submissions'),
      api('/api/user/profile').catch(() => ({ current_streak: 0, target_band: null })),
      api('/api/tests/attempts').catch(() => [])
    ]);

    const graded = submissions.filter(s => s.status === 'graded' && s.overall_band != null);
    const bands = graded.map(s => s.overall_band);
    const avg = bands.length ? (bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1) : '–';
    const best = bands.length ? Math.max(...bands).toFixed(1) : '–';

    document.getElementById('stat-total').textContent = submissions.length;
    document.getElementById('stat-graded').textContent = graded.length;
    document.getElementById('stat-avg').textContent = avg;
    document.getElementById('stat-best').textContent = best;

    // Streak
    const streak = profile.current_streak || 0;
    document.getElementById('stat-streak').textContent = streak;
    const streakCard = document.querySelector('.stat-streak-card');
    if (streakCard) streakCard.classList.toggle('streak-active', streak > 0);

    // Reading / Listening avg bands from test attempts
    const completedAttempts = (testAttempts || []).filter(a => a.status === 'completed' && a.score);
    const readingBands = completedAttempts.filter(a => a.type === 'reading').map(a => a.score.band);
    const listeningBands = completedAttempts.filter(a => a.type === 'listening').map(a => a.score.band);
    const readingAvg = readingBands.length ? (readingBands.reduce((a,b)=>a+b,0)/readingBands.length).toFixed(1) : '–';
    const listeningAvg = listeningBands.length ? (listeningBands.reduce((a,b)=>a+b,0)/listeningBands.length).toFixed(1) : '–';
    const readingAvgEl = document.getElementById('stat-reading-avg');
    const listeningAvgEl = document.getElementById('stat-listening-avg');
    if (readingAvgEl) readingAvgEl.textContent = readingAvg;
    if (listeningAvgEl) listeningAvgEl.textContent = listeningAvg;

    // Target band tracker
    renderTargetBandBars(profile.target_band, avg === '–' ? null : parseFloat(avg),
      readingAvg === '–' ? null : parseFloat(readingAvg),
      listeningAvg === '–' ? null : parseFloat(listeningAvg));

    // Populate target band select
    const sel = document.getElementById('target-band-select');
    if (sel && profile.target_band) {
      sel.value = String(profile.target_band);
    }

    // Weakest criterion callout
    const weakestCard = document.getElementById('weakest-criterion-card');
    if (weakestCard) {
      const wc = getWeakestCriterion(graded);
      if (wc) {
        document.getElementById('weakest-criterion-name').textContent = wc.label;
        document.getElementById('weakest-criterion-band').textContent = `avg band ${wc.avg}`;
        weakestCard.classList.remove('hidden');
      } else {
        weakestCard.classList.add('hidden');
      }
    }

    // Progress chart
    renderProgressChart(graded, completedAttempts);

    const recentEl = document.getElementById('recent-list');
    const recent = submissions.slice(0, 5);
    if (recent.length === 0) {
      recentEl.innerHTML = `<div class="empty-state">No submissions yet. <a href="#" onclick="showView('submit')">Submit your first essay!</a></div>`;
    } else {
      recentEl.innerHTML = recent.map(renderSubmissionCard).join('');
    }

    // Poll if any are still grading
    if (submissions.some(s => s.status === 'grading' || s.status === 'pending' || s.status === 'pending_review')) {
      clearInterval(pollingInterval);
      pollingInterval = setInterval(() => {
        if (document.getElementById('view-dashboard') && !document.getElementById('view-dashboard').classList.contains('hidden')) {
          loadDashboard();
        }
      }, 4000);
    } else {
      clearInterval(pollingInterval);
    }
  } catch (err) {
    console.error('Dashboard load error', err);
  }
}

function renderTargetBandBars(targetBand, writingAvg, readingAvg, listeningAvg) {
  const section = document.getElementById('target-band-section');
  const barsEl = document.getElementById('target-band-bars');
  if (!section || !barsEl) return;

  if (!targetBand) {
    barsEl.innerHTML = '<div class="target-band-hint">Set a target band above to track your progress toward your goal.</div>';
    return;
  }

  const skills = [
    { label: 'Writing', avg: writingAvg },
    { label: 'Reading', avg: readingAvg ?? null },
    { label: 'Listening', avg: listeningAvg ?? null }
  ];

  barsEl.innerHTML = skills.map(({ label, avg }) => {
    const pct = avg !== null ? Math.min(100, Math.round((avg / targetBand) * 100)) : 0;
    const displayAvg = avg !== null ? avg.toFixed(1) : '–';
    return `
      <div class="target-bar-row">
        <span class="target-bar-label">${label}</span>
        <div class="target-bar-track">
          <div class="target-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="target-bar-meta">${displayAvg} / ${targetBand}</span>
      </div>`;
  }).join('');
}

async function handleSetTargetBand() {
  const sel = document.getElementById('target-band-select');
  if (!sel || !sel.value) return;
  try {
    await api('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ target_band: parseFloat(sel.value) })
    });
    loadDashboard();
  } catch (err) {
    alert('Failed to save target band: ' + err.message);
  }
}

function renderProgressChart(graded, testAttempts) {
  const section = document.getElementById('chart-section');
  if (!section) return;

  const completedTests = (testAttempts || []).filter(a => a.status === 'completed' && a.score);
  const readingAttempts = completedTests.filter(a => a.type === 'reading');
  const listeningAttempts = completedTests.filter(a => a.type === 'listening');

  if (graded.length < 2 && readingAttempts.length < 2 && listeningAttempts.length < 2) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const sorted = [...graded].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Build a merged label set of all dates
  const allDates = [
    ...sorted.map(s => s.created_at.slice(0, 10)),
    ...readingAttempts.map(a => (a.submitted_at || a.started_at).slice(0, 10)),
    ...listeningAttempts.map(a => (a.submitted_at || a.started_at).slice(0, 10))
  ];
  const uniqueDates = [...new Set(allDates)].sort();
  const labels = uniqueDates.map(d => formatDate(d + 'T00:00:00.000Z'));

  const getDataForDates = (items, dateKey, valueKey) =>
    uniqueDates.map(d => {
      const item = items.find(i => (i[dateKey] || '').slice(0, 10) === d);
      return item ? (typeof valueKey === 'function' ? valueKey(item) : item[valueKey]) : null;
    });

  const datasets = [];
  if (sorted.length >= 2) {
    datasets.push({
      label: 'Writing',
      data: getDataForDates(sorted, 'created_at', 'overall_band'),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#4f46e5',
      pointRadius: 5,
      tension: 0.3,
      spanGaps: true
    });
  }
  if (readingAttempts.length >= 2) {
    datasets.push({
      label: 'Reading',
      data: getDataForDates(readingAttempts, 'submitted_at', a => a.score.band),
      borderColor: '#059669',
      backgroundColor: 'rgba(5,150,105,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#059669',
      pointRadius: 5,
      tension: 0.3,
      spanGaps: true
    });
  }
  if (listeningAttempts.length >= 2) {
    datasets.push({
      label: 'Listening',
      data: getDataForDates(listeningAttempts, 'submitted_at', a => a.score.band),
      borderColor: '#d97706',
      backgroundColor: 'rgba(217,119,6,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#d97706',
      pointRadius: 5,
      tension: 0.3,
      spanGaps: true
    });
  }

  const ctx = document.getElementById('progress-chart').getContext('2d');
  if (window.progressChart && typeof window.progressChart.destroy === 'function') {
    window.progressChart.destroy();
  }
  window.progressChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { callbacks: { label: ctx => `Band ${ctx.parsed.y}` } }
      },
      scales: {
        y: {
          min: 0, max: 9,
          ticks: { stepSize: 1 },
          title: { display: true, text: 'Band Score' }
        },
        x: { ticks: { maxRotation: 45 } }
      }
    }
  });
}

/* ─── History ────────────────────────────────────────────────────────────── */
async function loadHistory() {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '<div class="loading">Loading submissions…</div>';
  try {
    const submissions = await api('/api/submissions');
    if (submissions.length === 0) {
      listEl.innerHTML = `<div class="empty-state">No submissions yet. <a href="#" onclick="showView('submit')">Submit your first essay!</a></div>`;
      return;
    }
    listEl.innerHTML = submissions.map(renderSubmissionCard).join('');

    // Poll if pending
    if (submissions.some(s => s.status === 'grading' || s.status === 'pending' || s.status === 'pending_review')) {
      clearInterval(pollingInterval);
      pollingInterval = setInterval(() => {
        if (!document.getElementById('view-history').classList.contains('hidden')) {
          loadHistory();
        }
      }, 4000);
    } else {
      clearInterval(pollingInterval);
    }
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state">Failed to load submissions.</div>';
  }
}

function renderSubmissionCard(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  const scoreHtml = s.status === 'graded' && s.overall_band != null
    ? `<div class="band-score ${bandColor(s.overall_band)}">${s.overall_band}</div><div class="band-label">Band Score</div>`
    : statusChip(s.status);

  return `
    <div class="submission-card" onclick="viewFeedback(${s.id})">
      <div class="submission-badge ${badgeClass}">${taskLabel}</div>
      <div class="submission-info">
        <div class="submission-prompt">${escHtml(s.prompt)}</div>
        <div class="submission-meta">${s.word_count} words · ${formatDate(s.created_at)}</div>
      </div>
      <div class="submission-score">${scoreHtml}</div>
      <button class="btn-delete-submission" onclick="deleteSubmission(${s.id}, event)" title="Delete submission">🗑</button>
    </div>`;
}

async function deleteSubmission(id, event) {
  event.stopPropagation();
  if (!confirm('Delete this submission? This cannot be undone.')) return;
  try {
    await api(`/api/submissions/${id}`, { method: 'DELETE' });
    loadHistory();
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

/* ─── SSE Streaming Helper ───────────────────────────────────────────────── */
async function streamSSE(url, body, onChunk, onDone) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { onDone(); return; }
        try { onChunk(JSON.parse(payload)); } catch { /* skip malformed */ }
      }
    }
  }
  onDone();
}

/* ─── Topic Selector ─────────────────────────────────────────────────────── */
function updateTopicOptions() {
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const options = TOPIC_OPTIONS[taskType] || TOPIC_OPTIONS.task2;
  selectedTopic = 'random';

  const container = document.getElementById('topic-chips');
  if (!container) return;
  container.innerHTML = options.map(opt => `
    <button type="button"
      class="topic-chip${opt.value === 'random' ? ' active' : ''}"
      data-value="${opt.value}"
      onclick="selectTopic(this, '${opt.value}')">
      ${opt.label}
    </button>
  `).join('');

  // Show/hide Task 2 idea scaffold fields inside ideas-card
  const scaffoldFields = document.getElementById('scaffold-fields');
  if (scaffoldFields) {
    if (taskType === 'task2') scaffoldFields.classList.remove('hidden');
    else { scaffoldFields.classList.add('hidden'); clearScaffold(); }
  }
  // Update empty-state hint text for ideas card
  const ideasEmpty = document.querySelector('#ideas-body .hint-empty');
  if (ideasEmpty) {
    ideasEmpty.textContent = taskType === 'task2'
      ? 'Enter your ideas above or click "Generate ✨" for AI suggestions.'
      : 'Click "Generate ✨" to get body paragraph ideas.';
  }
}

function selectTopic(el, value) {
  selectedTopic = value;
  document.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

/* ─── Idea Scaffold ──────────────────────────────────────────────────────── */
function clearScaffold() {
  ['scaffold-thesis','scaffold-bp1','scaffold-bp2','scaffold-counter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function getScaffoldIdeas() {
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value;
  if (taskType !== 'task2') return null;
  const thesis  = (document.getElementById('scaffold-thesis')?.value  || '').trim();
  const bp1     = (document.getElementById('scaffold-bp1')?.value     || '').trim();
  const bp2     = (document.getElementById('scaffold-bp2')?.value     || '').trim();
  const counter = (document.getElementById('scaffold-counter')?.value || '').trim();
  if (!thesis && !bp1 && !bp2) return null; // all empty — no scaffold
  const parts = [];
  if (thesis)  parts.push(`Position/Thesis: ${thesis}`);
  if (bp1)     parts.push(`Body Paragraph 1 idea: ${bp1}`);
  if (bp2)     parts.push(`Body Paragraph 2 idea: ${bp2}`);
  if (counter) parts.push(`Counterargument: ${counter}`);
  return parts.join('\n');
}

/* ─── Task Generation ────────────────────────────────────────────────────── */
async function generateTask() {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const promptEl = document.getElementById('essay-prompt');
  const btn = document.getElementById('generate-btn');
  const btnLabel = document.getElementById('generate-btn-label');
  const btnIcon = document.getElementById('generate-btn-icon');

  btn.disabled = true;
  btnLabel.textContent = 'Generating…';
  btnIcon.textContent = '⏳';
  promptEl.value = '';
  promptUserTyped = false;
  hidePasteNudge();
  clearChart();

  if (task_type === 'task1') {
    // Task 1: fetch a random admin-uploaded topic (image + question)
    try {
      const chartType = (selectedTopic && selectedTopic !== 'random') ? selectedTopic : 'random';
      const params = chartType !== 'random' ? `?chart_type=${encodeURIComponent(chartType)}` : '';
      const topic = await api(`/api/task1-topics/random${params}`);
      promptEl.value = topic.question;
      promptUserTyped = false;
      displayTask1Topic(topic);
      btn.disabled = false;
      btnLabel.textContent = 'Generate Task';
      btnIcon.textContent = '✨';
    } catch (err) {
      btn.disabled = false;
      btnLabel.textContent = 'Generate Task';
      btnIcon.textContent = '✨';
      promptEl.placeholder = err.message || 'No topics available. Ask your teacher to upload some.';
    }
    return;
  }

  // Task 2: AI streaming generation
  try {
    await streamSSE(
      '/api/generate-task',
      { task_type, topic: selectedTopic || 'random' },
      (chunk) => { promptEl.value += chunk; },
      async () => {
        btn.disabled = false;
        btnLabel.textContent = 'Generate Task';
        btnIcon.textContent = '✨';
      }
    );
  } catch (err) {
    btn.disabled = false;
    btnLabel.textContent = 'Generate Task';
    btnIcon.textContent = '✨';
    promptEl.placeholder = 'Generation failed. Please try again.';
  }
}

/* ─── Display Admin-Uploaded Task 1 Topic ────────────────────────────────── */
function displayTask1Topic(topic) {
  const container = document.getElementById('chart-container');
  const imgEl = document.getElementById('chart-topic-image');
  const canvas = document.getElementById('task1-chart');
  const tableArea = document.getElementById('table-area');
  const titleEl = document.getElementById('chart-title-label');

  const frameEl = document.getElementById('chart-image-frame');
  if (!container || !imgEl) return;

  // Destroy any existing Chart.js instance
  if (activeChart) { activeChart.destroy(); activeChart = null; }

  // Hide canvas & table, show image frame
  if (canvas) canvas.style.display = 'none';
  if (tableArea) { tableArea.classList.add('hidden'); tableArea.innerHTML = ''; }

  imgEl.src = `data:${topic.image_media_type};base64,${topic.image_base64}`;
  if (frameEl) frameEl.classList.remove('hidden');
  else imgEl.classList.remove('hidden');

  // Update title label
  const typeLabel = {
    bar_chart: '📊 Bar Chart',
    line_graph: '📈 Line Graph',
    pie_chart: '🥧 Pie Chart',
    table: '📋 Table',
    process_diagram: '⚙️ Process Diagram',
    map: '🗺️ Map'
  }[topic.chart_type] || '📊 Chart';
  if (titleEl) titleEl.textContent = typeLabel + (topic.label ? ` — ${topic.label}` : '');

  // Show container
  container.classList.remove('hidden');

  // Auto-populate image state so it gets submitted with the essay
  task1ImageBase64 = topic.image_base64;
  task1ImageMediaType = topic.image_media_type;
}

/* ─── Paste / Type Detection ─────────────────────────────────────────────── */
function onPromptInput() {
  const val = document.getElementById('essay-prompt').value.trim();
  promptUserTyped = true;
  if (val.length > 20) {
    showPasteNudge();
  } else {
    hidePasteNudge();
  }
  // Hide chart when user manually edits the prompt
  clearChart();
  // Auto-save draft
  onDraftInput();
}

function showPasteNudge() {
  const el = document.getElementById('paste-hint-nudge');
  if (el) el.classList.remove('hidden');
}

function hidePasteNudge() {
  const el = document.getElementById('paste-hint-nudge');
  if (el) el.classList.add('hidden');
}

/* ─── Chart Generation & Rendering ──────────────────────────────────────── */
function clearChart() {
  if (activeChart) { activeChart.destroy(); activeChart = null; }
  const container = document.getElementById('chart-container');
  const tableArea = document.getElementById('table-area');
  const canvas = document.getElementById('task1-chart');
  const imgEl = document.getElementById('chart-topic-image');
  const frameEl2 = document.getElementById('chart-image-frame');
  if (container) container.classList.add('hidden');
  if (tableArea) { tableArea.classList.add('hidden'); tableArea.innerHTML = ''; }
  if (canvas) canvas.style.display = '';
  if (frameEl2) { frameEl2.classList.add('hidden'); }
  if (imgEl) { imgEl.src = ''; }
  // Clear task1 image state
  task1ImageBase64 = null;
  task1ImageMediaType = null;
}

async function generateChart(taskText) {
  const container = document.getElementById('chart-container');
  const statusEl = document.getElementById('chart-status');
  if (!container) return;

  clearChart();
  container.classList.remove('hidden');
  if (statusEl) { statusEl.textContent = '⏳ Generating chart…'; statusEl.className = 'chart-status loading'; }

  try {
    const res = await fetch('/api/generate-chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ task_text: taskText }),
    });
    if (!res.ok) throw new Error('Chart request failed');
    const data = await res.json();

    if (data.type === 'unsupported') {
      if (statusEl) { statusEl.textContent = data.message || 'No preview for this chart type'; statusEl.className = 'chart-status'; }
      container.classList.add('hidden');
      return;
    }

    renderChart(data);
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'chart-status'; }
  } catch (err) {
    if (statusEl) { statusEl.textContent = 'Chart preview unavailable'; statusEl.className = 'chart-status'; }
    console.error('Chart error:', err);
  }
}

const CHART_COLORS = [
  'rgba(99,102,241,0.8)',   // indigo
  'rgba(16,185,129,0.8)',   // emerald
  'rgba(245,158,11,0.8)',   // amber
  'rgba(239,68,68,0.8)',    // red
  'rgba(59,130,246,0.8)',   // blue
  'rgba(168,85,247,0.8)',   // purple
  'rgba(20,184,166,0.8)',   // teal
  'rgba(251,146,60,0.8)',   // orange
];
const CHART_BORDERS = CHART_COLORS.map(c => c.replace('0.8', '1'));

function renderChart(data) {
  if (data.type === 'table') {
    renderTable(data);
    return;
  }

  const canvas = document.getElementById('task1-chart');
  if (!canvas) return;
  canvas.style.display = '';

  if (activeChart) { activeChart.destroy(); activeChart = null; }

  const titleEl = document.getElementById('chart-title-label');
  if (titleEl && data.title) titleEl.textContent = '📊 ' + data.title;

  const datasets = (data.datasets || []).map((ds, i) => ({
    label: ds.label || '',
    data: ds.data,
    backgroundColor: data.type === 'pie'
      ? CHART_COLORS.slice(0, (ds.data || []).length)
      : CHART_COLORS[i % CHART_COLORS.length],
    borderColor: data.type === 'pie'
      ? CHART_BORDERS.slice(0, (ds.data || []).length)
      : CHART_BORDERS[i % CHART_BORDERS.length],
    borderWidth: data.type === 'pie' ? 2 : 1.5,
    fill: data.type === 'line' ? false : undefined,
    tension: data.type === 'line' ? 0.3 : undefined,
    pointRadius: data.type === 'line' ? 4 : undefined,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: data.type === 'pie' || datasets.length > 1,
        position: 'bottom',
        labels: { font: { size: 12 }, padding: 12 },
      },
      title: { display: false },
    },
    scales: data.type === 'pie' ? {} : {
      x: {
        title: { display: !!data.xlabel, text: data.xlabel || '', font: { size: 12 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        title: { display: !!data.ylabel, text: data.ylabel || '', font: { size: 12 } },
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
    },
  };

  activeChart = new Chart(canvas, {
    type: data.type,
    data: { labels: data.labels || [], datasets },
    options,
  });
}

function renderTable(data) {
  const canvas = document.getElementById('task1-chart');
  const tableArea = document.getElementById('table-area');
  if (!tableArea) return;
  if (canvas) canvas.style.display = 'none';

  const titleEl = document.getElementById('chart-title-label');
  if (titleEl && data.title) titleEl.textContent = '📋 ' + data.title;

  const headers = (data.headers || []).map(h => `<th>${escHtml(String(h))}</th>`).join('');
  const rows = (data.rows || []).map(row =>
    `<tr>${row.map(cell => `<td>${escHtml(String(cell))}</td>`).join('')}</tr>`
  ).join('');

  tableArea.innerHTML = `
    <table class="chart-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  tableArea.classList.remove('hidden');
}

/* ─── Hints ──────────────────────────────────────────────────────────────── */
// Legacy function kept for backward compatibility
function closeHintPanel() {
  const panel = document.getElementById('hint-panel');
  if (panel) panel.classList.add('hidden');
}

async function requestHint(hint_type) {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();

  const panel = document.getElementById('hint-panel');
  const panelTitle = document.getElementById('hint-panel-title');
  const panelBody = document.getElementById('hint-panel-body');

  if (!panel) return; // Legacy panel may not exist

  panelTitle.textContent = hint_type === 'ideas' ? '💡 Idea Hints' : '📚 Vocabulary & Collocations';
  panelBody.innerHTML = '<span class="hint-thinking">Thinking…</span>';
  panel.classList.remove('hidden');

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  let raw = '';
  try {
    await streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type },
      (chunk) => {
        raw += chunk;
        panelBody.innerHTML = renderHintMarkdown(raw);
      },
      () => {
        panelBody.innerHTML = renderHintMarkdown(raw);
      }
    );
  } catch (err) {
    panelBody.innerHTML = `<span style="color:var(--danger)">Failed to load hints. ${escHtml(err.message)}</span>`;
  }
}

async function requestSingleHint(hint_type) {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  // vocabulary merged into phrases card for Task 2
  if (hint_type === 'vocabulary' && task_type !== 'task1') hint_type = 'phrases';
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();
  if (!prompt) { alert('Please enter a writing prompt first.'); return; }

  const bodyMap = { ideas: 'ideas-body', vocabulary: 'vocab-body', phrases: 'phrases-body', structure: 'structure-body' };
  const btnMap  = { ideas: 'ideas-btn',  vocabulary: 'vocab-btn',  phrases: 'phrases-btn',  structure: 'structure-btn'  };
  const body = document.getElementById(bodyMap[hint_type]);
  const btn  = document.getElementById(btnMap[hint_type]);
  if (!body) return;

  const student_ideas = hint_type === 'ideas' ? getScaffoldIdeas() : null;

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  body.innerHTML = '<span class="hint-thinking">Generating…</span>';
  let raw = '';
  try {
    await streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type, student_ideas },
      (chunk) => { raw += chunk; body.innerHTML = renderHintMarkdown(raw); },
      () => { body.innerHTML = renderHintMarkdown(raw); }
    );
  } catch (err) {
    body.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate ✨'; }
  }
}

async function requestBothHints() {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();
  if (!prompt) { alert('Please enter a writing prompt first.'); return; }

  const isTask1 = task_type === 'task1';

  const ideasBody    = document.getElementById('ideas-body');
  const vocabBody    = document.getElementById('vocab-body');
  const phrasesBody  = document.getElementById('phrases-body');
  const structBody   = document.getElementById('structure-body');
  const btn          = document.getElementById('refresh-hints-btn');
  const ideasBtn     = document.getElementById('ideas-btn');
  const vocabBtn     = document.getElementById('vocab-btn');
  const phrasesBtn   = document.getElementById('phrases-btn');
  const structBtn    = document.getElementById('structure-btn');

  const disable = (el, label) => { if (el) { el.disabled = true; el.textContent = label; } };
  const enable  = (el, label) => { if (el) { el.disabled = false; el.textContent = label; } };

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  const promises = [];

  if (isTask1) {
    // Task 1: Structure Guide + Phrases only
    if (structBody) structBody.innerHTML = '<span class="hint-thinking">Generating structure guide…</span>';
    if (phrasesBody) phrasesBody.innerHTML = '<span class="hint-thinking">Generating phrases…</span>';
    disable(structBtn, '⏳'); disable(phrasesBtn, '⏳');

    let structRaw = '';
    promises.push(streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type: 'structure' },
      (chunk) => { structRaw += chunk; if (structBody) structBody.innerHTML = renderHintMarkdown(structRaw); },
      () => { if (structBody) structBody.innerHTML = renderHintMarkdown(structRaw); }
    ).catch(err => { if (structBody) structBody.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`; }));

    let phrasesRaw = '';
    promises.push(streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type: 'phrases' },
      (chunk) => { phrasesRaw += chunk; if (phrasesBody) phrasesBody.innerHTML = renderHintMarkdown(phrasesRaw); },
      () => { if (phrasesBody) phrasesBody.innerHTML = renderHintMarkdown(phrasesRaw); }
    ).catch(err => { if (phrasesBody) phrasesBody.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`; }));

    await Promise.all(promises);
    enable(structBtn, 'Generate ✨'); enable(phrasesBtn, 'Generate ✨');
  } else {
    // Task 2: Body Arguments + Language Toolkit (phrases+vocab merged)
    if (ideasBody) ideasBody.innerHTML = '<span class="hint-thinking">Generating body arguments…</span>';
    if (phrasesBody) phrasesBody.innerHTML = '<span class="hint-thinking">Generating language toolkit…</span>';
    disable(ideasBtn, '⏳'); disable(phrasesBtn, '⏳');

    const student_ideas = getScaffoldIdeas();
    let ideasRaw = '';
    promises.push(streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type: 'ideas', student_ideas },
      (chunk) => { ideasRaw += chunk; if (ideasBody) ideasBody.innerHTML = renderHintMarkdown(ideasRaw); },
      () => { if (ideasBody) ideasBody.innerHTML = renderHintMarkdown(ideasRaw); }
    ).catch(err => { if (ideasBody) ideasBody.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`; }));

    let phrasesRaw = '';
    promises.push(streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type: 'phrases' },
      (chunk) => { phrasesRaw += chunk; if (phrasesBody) phrasesBody.innerHTML = renderHintMarkdown(phrasesRaw); },
      () => { if (phrasesBody) phrasesBody.innerHTML = renderHintMarkdown(phrasesRaw); }
    ).catch(err => { if (phrasesBody) phrasesBody.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`; }));

    await Promise.all(promises);
    enable(ideasBtn, 'Generate ✨'); enable(phrasesBtn, 'Generate ✨');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Generate All'; }
  hidePasteNudge();
}

async function syncAnthropicBalance() {
  const input = document.getElementById('balance-input');
  const val = parseFloat(input?.value);
  if (isNaN(val) || val < 0) { alert('Please enter a valid balance (e.g. 4.65)'); return; }
  try {
    await api('/api/admin/settings/balance', { method: 'PUT', body: JSON.stringify({ balance: val }) });
    input.value = '';
    await loadAdminCostBreakdown();
  } catch (err) {
    alert('Failed to save balance: ' + err.message);
  }
}

async function loadAdminCostBreakdown() {
  const el = document.getElementById('admin-cost-content');
  if (!el) return;
  try {
    const data = await api('/api/admin/cost-breakdown');
    const total = data.starting_balance || (data.remaining_balance + data.total_cost);
    const pct = total > 0 ? Math.round((data.remaining_balance / total) * 100) : 0;
    // Pre-fill the sync input with current starting balance as placeholder
    const balInput = document.getElementById('balance-input');
    if (balInput && !balInput.value) balInput.placeholder = `current: $${(data.starting_balance || 0).toFixed(2)}`;

    // What costs money — reference table
    const costRef = [
      { op: 'Essay Grading', who: 'Student submits essay', approx: '~$0.04–0.08' },
      { op: 'AI Writing Hints', who: 'Student clicks Generate Hints', approx: '~$0.01–0.02' },
      { op: 'Smart Rewrite', who: 'Student requests rewrite', approx: '~$0.02–0.04' },
      { op: 'Topic Generation', who: 'Admin generates task prompt', approx: '~$0.005' },
      { op: 'Chart Description AI', who: 'Task 1 image analysis', approx: '~$0.01' },
      { op: 'Test AI Explanations', who: 'Student submits Reading/Listening test', approx: '~$0.003' },
    ];

    el.innerHTML = `
      <div class="cost-summary-row">
        <div class="cost-summary-item">
          <div class="cost-val">$${data.total_cost.toFixed(4)}</div>
          <div class="cost-lbl">Total Spent</div>
        </div>
        <div class="cost-summary-item">
          <div class="cost-val" style="color:#16a34a">$${data.remaining_balance.toFixed(4)}</div>
          <div class="cost-lbl">Remaining Balance</div>
        </div>
        <div class="cost-summary-item" style="flex:2">
          <div class="cost-balance-bar">
            <div class="cost-balance-fill" style="width:${pct}%"></div>
          </div>
          <div class="cost-lbl">${pct}% remaining</div>
        </div>
      </div>

      ${data.breakdown.length ? `
        <div class="cost-tables-row">
          <div class="cost-table-wrap">
            <div class="cost-table-title">📊 Spending by Feature</div>
            <table class="cost-table">
              <thead><tr><th>Feature</th><th>Uses</th><th>Cost</th></tr></thead>
              <tbody>
                ${data.breakdown.map(b => `
                  <tr>
                    <td>${b.label}</td>
                    <td>${b.count}</td>
                    <td>$${b.cost.toFixed(4)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="cost-table-wrap">
            <div class="cost-table-title">💡 Cost Reference (per operation)</div>
            <table class="cost-table">
              <thead><tr><th>Operation</th><th>Triggered by</th><th>Approx. Cost</th></tr></thead>
              <tbody>
                ${costRef.map(r => `
                  <tr>
                    <td>${r.op}</td>
                    <td style="color:var(--gray-500);font-size:12px">${r.who}</td>
                    <td>${r.approx}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : '<div class="cost-lbl" style="padding:8px 0">No AI usage recorded yet.</div>'}
    `;
  } catch (err) {
    el.innerHTML = `<span style="color:var(--danger);font-size:13px">Failed to load: ${err.message}</span>`;
  }
}

function renderHintMarkdown(text) {
  // Bold **text**
  let html = escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  return html;
}

/* ─── Submit ─────────────────────────────────────────────────────────────── */
function updateWordCount() {
  const text = document.getElementById('essay-text').value;
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const min = taskType === 'task1' ? 150 : 250;
  const badge = document.getElementById('word-count-badge');
  if (badge) {
    badge.textContent = `${count} words`;
    badge.className = 'word-count-badge' + (count >= min ? ' ok' : count > 0 ? ' warn' : '');
  }
  // Progress bar
  const fill = document.getElementById('word-count-bar-fill');
  const barText = document.getElementById('word-count-bar-text');
  if (fill) {
    const pct = Math.min(100, Math.round((count / min) * 100));
    fill.style.width = pct + '%';
    fill.className = 'word-count-bar-fill' + (count >= min ? ' bar-ok' : count >= Math.round(min * 0.6) ? ' bar-warn' : ' bar-low');
  }
  if (barText) barText.textContent = `${count} / ${min} words`;
}

function updateTaskInfo() {
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const label = taskType === 'task1' ? 'Task 1 requires a minimum of 150 words.' : 'Task 2 requires a minimum of 250 words.';
  document.getElementById('word-count-info').textContent = label;

  // Update card styling
  document.querySelectorAll('.task-option-card').forEach(c => c.classList.remove('active'));
  const checked = document.querySelector('input[name="task_type"]:checked');
  if (checked) checked.nextElementSibling.classList.add('active');

  // Show/hide image upload for Task 1
  const imgSection = document.getElementById('task1-image-section');
  if (imgSection) imgSection.classList.toggle('hidden', taskType !== 'task1');

  // Hide chart if switching away from Task 1
  if (taskType !== 'task1') { clearChart(); removeImage(); }

  updateWordCount();
  updateTopicOptions();

  // Switch hint panel layout based on task type
  const isTask1 = taskType === 'task1';
  // ideas-card: visible for task2 only
  const ideasCard = document.getElementById('ideas-card');
  if (ideasCard) ideasCard.style.display = isTask1 ? 'none' : '';
  // vocab-card: always hidden (content merged into phrases/language-toolkit card)
  const vocabCard = document.getElementById('vocab-card');
  if (vocabCard) vocabCard.style.display = 'none';
  // structure-card: visible for task1 only
  const structCard = document.getElementById('structure-card');
  if (structCard) structCard.style.display = isTask1 ? '' : 'none';
}

/* ─── Task 1 Image Upload ─────────────────────────────────────────────────── */
let task1ImageBase64 = null;
let task1ImageMediaType = null;

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be under 5 MB.');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // Extract base64 and media type from data URL
    const [header, b64] = dataUrl.split(',');
    task1ImageBase64 = b64;
    task1ImageMediaType = header.match(/:(.*?);/)[1];

    // Show preview, hide placeholder
    const preview = document.getElementById('image-preview');
    const placeholder = document.getElementById('image-upload-placeholder');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    document.getElementById('remove-image-btn').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  task1ImageBase64 = null;
  task1ImageMediaType = null;
  const input = document.getElementById('task1-image-input');
  if (input) input.value = '';
  const preview = document.getElementById('image-preview');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  const placeholder = document.getElementById('image-upload-placeholder');
  if (placeholder) placeholder.classList.remove('hidden');
  const btn = document.getElementById('remove-image-btn');
  if (btn) btn.classList.add('hidden');
}

/* ─── Paste Detection ────────────────────────────────────────────────────── */
function initPasteTracking() {
  const ta = document.getElementById('essay-text');
  if (!ta || ta.dataset.pasteTracked) return;
  ta.dataset.pasteTracked = '1';

  // Reset stats whenever the submit view is loaded fresh
  pasteStats = { paste_count: 0, total_pasted: 0, total_typed: 0, largest_paste: 0 };

  ta.addEventListener('paste', (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    const len = pasted.length;
    if (len > 0) {
      pasteStats.paste_count += 1;
      pasteStats.total_pasted += len;
      if (len > pasteStats.largest_paste) pasteStats.largest_paste = len;
    }
  });

  ta.addEventListener('input', (e) => {
    // Count typed characters (input events that aren't paste)
    if (e.inputType && e.inputType.startsWith('insert') && e.inputType !== 'insertFromPaste') {
      pasteStats.total_typed += (e.data || '').length;
    }
  });

  // Auto-collapse upload area when student starts writing (Task 1, no image yet)
  let uploadCollapsed = false;
  ta.addEventListener('input', function collapseUpload() {
    if (uploadCollapsed) return;
    const uploadArea = document.getElementById('image-upload-area');
    const toggleBtn = document.getElementById('img-section-toggle');
    const section = document.getElementById('task1-image-section');
    if (!section || section.classList.contains('hidden')) return;
    if (ta.value.length > 20 && !task1ImageBase64) {
      if (uploadArea) uploadArea.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = '';
      uploadCollapsed = true;
    }
  });
}

function toggleImgSection() {
  const area = document.getElementById('image-upload-area');
  const toggle = document.getElementById('img-section-toggle');
  const isHidden = area && area.style.display === 'none';
  if (area) area.style.display = isHidden ? '' : 'none';
  if (toggle) toggle.textContent = isHidden ? '🙈 Hide upload area' : '📎 Attach / change image';
}

async function handleSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('submit-error');
  const successEl = document.getElementById('submit-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const task_type = document.querySelector('input[name="task_type"]:checked')?.value;
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();

  if (!task_type) { errEl.textContent = 'Please select a task type.'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  try {
    const gradingMode = document.querySelector('input[name="grading_mode"]:checked')?.value || 'teacher';
    const body = { task_type, prompt, essay, grading_mode: gradingMode, paste_stats: pasteStats };
    if (task_type === 'task1' && task1ImageBase64) {
      body.image_base64 = task1ImageBase64;
      body.image_media_type = task1ImageMediaType;
    }
    const result = await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    const modeMsg = gradingMode === 'ai'
      ? 'AI grading is in progress — results will appear shortly.'
      : 'Your essay is in the teacher review queue. A teacher will grade it soon.';
    successEl.innerHTML = `
      Essay submitted! (${result.word_count} words) — ${modeMsg}<br/>
      <small>Track progress in <a href="#" onclick="showView('history')">My Submissions</a>.</small>`;
    successEl.classList.remove('hidden');

    // Reset form and clear saved draft
    document.getElementById('essay-prompt').value = '';
    document.getElementById('essay-text').value = '';
    removeImage();
    updateWordCount();
    localStorage.removeItem(DRAFT_KEY);
    const banner = document.getElementById('draft-restore-banner');
    if (banner) banner.classList.add('hidden');

    // Auto-complete linked homework assignment (if started from Homework view)
    if (window._pendingHomeworkAssignmentId) {
      try {
        await api(`/api/assignments/${window._pendingHomeworkAssignmentId}/complete`, { method: 'POST' });
      } catch (e) { /* non-fatal */ }
      window._pendingHomeworkAssignmentId = null;
    }

    // Auto-navigate to history after 2s
    setTimeout(() => showView('history'), 2000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit for Grading';
  }
}

/* ─── Feedback ───────────────────────────────────────────────────────────── */
async function viewFeedback(id) {
  showView('feedback');
  document.getElementById('nav-history').classList.add('active');
  document.getElementById('feedback-content').innerHTML = '<div class="loading">Loading feedback…</div>';

  try {
    const s = await api(`/api/submissions/${id}`);
    renderFeedback(s);

    // Poll if still grading
    if (s.status === 'grading' || s.status === 'pending' || s.status === 'pending_review') {
      clearInterval(pollingInterval);
      pollingInterval = setInterval(async () => {
        if (document.getElementById('view-feedback').classList.contains('hidden')) {
          clearInterval(pollingInterval); return;
        }
        const updated = await api(`/api/submissions/${id}`);
        if (updated.status === 'graded' || updated.status === 'error') {
          clearInterval(pollingInterval);
          renderFeedback(updated);
        }
      }, 4000);
    }
  } catch (err) {
    document.getElementById('feedback-content').innerHTML = '<div class="empty-state">Failed to load feedback.</div>';
  }
}

function exportFeedbackPDF() {
  const el = document.getElementById('feedback-content');
  if (!el) return;
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `IELTS-Feedback-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(el).save();
}

function renderFeedback(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  let html = '';

  // PDF export button (only when graded)
  if (s.status === 'graded' && s.overall_band != null) {
    html += `<div class="pdf-export-bar"><button id="pdf-btn" class="btn btn-secondary btn-sm" onclick="exportFeedbackPDF()">⬇️ Download PDF</button></div>`;
  }

  // Header card
  html += `
    <div class="feedback-header">
      <div class="feedback-task-info">
        <span class="submission-badge ${badgeClass}" style="width:auto;padding:4px 12px;">${taskLabel}</span>
        <span style="color:var(--gray-500);font-size:13px;">${s.word_count} words · Submitted ${formatDate(s.created_at)}</span>
      </div>
      <div style="font-weight:600;color:var(--gray-700);margin-bottom:8px;">Prompt:</div>
      <div style="font-size:14px;color:var(--gray-600);line-height:1.6;">${escHtml(s.prompt)}</div>
    </div>`;

  if (s.status === 'pending_review') {
    html += `
      <div class="grading-notice grading-notice-review">
        <strong>👩‍🏫 Awaiting Teacher Review</strong>
        Your essay is in the grading queue. A teacher will review and grade it soon. This page will update automatically when grading is complete.
      </div>`;
  } else if (s.status === 'grading' || s.status === 'pending') {
    html += `
      <div class="grading-notice">
        <strong>⏳ AI Grading in Progress</strong>
        Your essay is being graded by AI. This usually takes 15–30 seconds. This page will update automatically.
      </div>`;
  } else if (s.status === 'error') {
    html += `
      <div class="grading-notice" style="background:var(--danger-light);border-color:#fecaca;color:var(--danger);">
        <strong>Grading Error</strong>
        There was a problem grading this essay.
      </div>
      <div class="retry-grade-bar">
        <button class="btn btn-primary btn-sm" onclick="retryGrading(${s.id})">🔄 Retry Grading</button>
      </div>`;
  } else if (s.status === 'graded' && s.overall_band != null) {
    // Show graded-by badge
    if (s.graded_by) {
      html += `<div style="margin-bottom:12px;"><span class="badge-teacher-graded">👨‍🏫 Graded by Teacher</span></div>`;
    } else {
      html += `<div style="margin-bottom:12px;"><span class="badge-ai-graded">🤖 AI Graded</span></div>`;
    }

    // Overall band
    html += `
      <div class="overall-band-display">
        <div class="overall-number">${s.overall_band}</div>
        <div class="overall-label">Overall Band Score</div>
      </div>`;

    // Band breakdown
    const taLabel = s.task_type === 'task1' ? 'Task Achievement' : 'Task Response';
    html += `
      <div class="feedback-section">
        <h3>Score Breakdown</h3>
        <div class="band-breakdown">
          ${bandItem(s.task_achievement, taLabel)}
          ${bandItem(s.coherence_cohesion, 'Coherence &amp; Cohesion')}
          ${bandItem(s.lexical_resource, 'Lexical Resource')}
          ${bandItem(s.grammatical_range, 'Grammatical Range &amp; Accuracy')}
        </div>
      </div>`;

    // Parse criterion details once — must come before any use of criterionData
    let criterionData = null;
    if (s.criterion_details) {
      try {
        criterionData = typeof s.criterion_details === 'string' ? JSON.parse(s.criterion_details) : s.criterion_details;
      } catch {}
    }

    // "What to fix" summary — top 3 improvements from weakest criteria
    if (criterionData) {
      const criterionLabelsLocal = {
        task_achievement: s.task_type === 'task1' ? 'Task Achievement' : 'Task Response',
        coherence_cohesion: 'Coherence & Cohesion',
        lexical_resource: 'Lexical Resource',
        grammatical_range: 'Grammatical Range & Accuracy'
      };
      const sorted = ['task_achievement','coherence_cohesion','lexical_resource','grammatical_range']
        .filter(k => criterionData[k])
        .sort((a, b) => (criterionData[a].band || 9) - (criterionData[b].band || 9));
      const topFixes = [];
      for (const k of sorted) {
        const improvs = Array.isArray(criterionData[k].improvements) ? criterionData[k].improvements : [];
        for (const imp of improvs) {
          if (topFixes.length < 3) topFixes.push({ label: criterionLabelsLocal[k], text: imp });
          if (topFixes.length >= 3) break;
        }
        if (topFixes.length >= 3) break;
      }
      if (topFixes.length > 0) {
        html += `
          <div class="feedback-section fix-summary-card">
            <h3>🎯 Focus for Your Next Essay</h3>
            <div class="fix-items">
              ${topFixes.map((f, i) => `
                <div class="fix-item">
                  <div class="fix-number">${i + 1}</div>
                  <div class="fix-content">
                    <div class="fix-criterion">${escHtml(f.label)}</div>
                    <div class="fix-text">${escHtml(f.text)}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>`;
      }
    }

    // Radar chart
    html += `
      <div class="feedback-section radar-chart-section">
        <h3>📊 Skill Radar</h3>
        <div class="radar-chart-container">
          <canvas id="feedback-radar-chart" height="260"></canvas>
        </div>
      </div>`;

    // Flashcard button
    html += `
      <div class="pdf-export-bar" style="margin-bottom:0">
        <button class="btn btn-secondary btn-sm" onclick="openFlashcards(${s.id})">📚 Vocabulary Flashcards</button>
      </div>`;

    // Criterion details cards
    if (criterionData) {
      const criterionLabels = {
        task_achievement: s.task_type === 'task1' ? 'Task Achievement' : 'Task Response',
        coherence_cohesion: 'Coherence & Cohesion',
        lexical_resource: 'Lexical Resource',
        grammatical_range: 'Grammatical Range & Accuracy'
      };

      html += `<div class="feedback-section"><h3>Criterion Analysis</h3><div class="criterion-grid">`;

      for (const key of ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range']) {
        const cd = criterionData[key];
        if (!cd) continue;
        const band = cd.band;
        const strengthsList = Array.isArray(cd.strengths) ? cd.strengths.map(i => `<li>${escHtml(i)}</li>`).join('') : '';
        const improvList = Array.isArray(cd.improvements) ? cd.improvements.map(i => `<li>${escHtml(i)}</li>`).join('') : '';
        html += `
          <div class="criterion-card collapsed" id="crit-${key}">
            <div class="criterion-card-header" onclick="toggleCriterion('${key}')">
              <span class="criterion-name">${escHtml(criterionLabels[key])}</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="criterion-band ${bandColor(band)}">${band != null ? band : '–'}</span>
                <span class="criterion-chevron">▾</span>
              </div>
            </div>
            <div class="criterion-body">
              ${cd.descriptor ? `<div class="criterion-descriptor">${escHtml(cd.descriptor)}</div>` : ''}
              ${strengthsList ? `<div class="criterion-strengths"><h5>Strengths</h5><ul>${strengthsList}</ul></div>` : ''}
              ${improvList ? `<div class="criterion-improvements"><h5>Improvements</h5><ul>${improvList}</ul></div>` : ''}
            </div>
          </div>`;
      }

      html += `</div></div>`;
    }

    // Sentence analysis
    let sentenceData = null;
    if (s.sentence_analysis) {
      try {
        sentenceData = typeof s.sentence_analysis === 'string' ? JSON.parse(s.sentence_analysis) : s.sentence_analysis;
      } catch {}
    }

    if (sentenceData && Array.isArray(sentenceData) && sentenceData.length > 0) {
      // Count by type
      const counts = { simple: 0, compound: 0, complex: 0, 'compound-complex': 0, uncertain: 0 };
      for (const entry of sentenceData) {
        if (counts[entry.t] !== undefined) counts[entry.t]++;
        else counts.uncertain++;
      }

      const typeColors = {
        simple: 'rgba(59,130,246,0.15)',
        compound: 'rgba(16,185,129,0.15)',
        complex: 'rgba(245,158,11,0.15)',
        'compound-complex': 'rgba(139,92,246,0.15)',
        uncertain: 'rgba(156,163,175,0.2)'
      };
      const typeLabels = {
        simple: 'Simple',
        compound: 'Compound',
        complex: 'Complex',
        'compound-complex': 'Compound-Complex',
        uncertain: 'Uncertain'
      };
      const dotColors = {
        simple: '#3b82f6',
        compound: '#10b981',
        complex: '#f59e0b',
        'compound-complex': '#8b5cf6',
        uncertain: '#9ca3af'
      };
      const badgeBgColors = {
        simple: '#dbeafe',
        compound: '#d1fae5',
        complex: '#fef3c7',
        'compound-complex': '#ede9fe',
        uncertain: '#f3f4f6'
      };
      const badgeTextColors = {
        simple: '#1d4ed8',
        compound: '#065f46',
        complex: '#92400e',
        'compound-complex': '#5b21b6',
        uncertain: '#6b7280'
      };

      let legendHtml = '<div class="sentence-legend">';
      for (const type of Object.keys(typeLabels)) {
        legendHtml += `<div class="legend-item"><div class="legend-dot" style="background:${dotColors[type]}"></div>${typeLabels[type]}</div>`;
      }
      legendHtml += '</div>';

      let countsHtml = '<div class="sentence-counts">';
      for (const type of Object.keys(typeLabels)) {
        if (counts[type] > 0) {
          countsHtml += `<span class="count-badge" style="background:${badgeBgColors[type]};color:${badgeTextColors[type]}">${typeLabels[type]}: ${counts[type]}</span>`;
        }
      }
      countsHtml += '</div>';

      const highlightedEssay = highlightSentences(s.essay, sentenceData);

      html += `
        <div class="feedback-section sentence-analysis-section">
          <h3>Sentence Structure Analysis</h3>
          ${legendHtml}
          ${countsHtml}
          <div class="highlighted-essay">${highlightedEssay}</div>
        </div>`;
    }

    // Overall improvements section
    let overallImprovData = null;
    if (s.overall_improvements) {
      try {
        overallImprovData = typeof s.overall_improvements === 'string' ? JSON.parse(s.overall_improvements) : s.overall_improvements;
      } catch {}
    }

    if (overallImprovData) {
      const improvKeys = [
        { key: 'content', label: 'Content' },
        { key: 'organization', label: 'Organization' },
        { key: 'vocabulary', label: 'Vocabulary' },
        { key: 'grammar', label: 'Grammar' },
        { key: 'sentence_variety', label: 'Sentence Variety' },
        { key: 'coherence', label: 'Coherence' }
      ];

      html += `<div class="feedback-section overall-improvements-section"><h3>Areas for Improvement</h3><div class="improvements-grid">`;
      for (const { key, label } of improvKeys) {
        if (overallImprovData[key]) {
          html += `
            <div class="improvement-card">
              <div class="improvement-card-title">${label}</div>
              <div class="improvement-card-text">${escHtml(overallImprovData[key])}</div>
            </div>`;
        }
      }
      html += `</div></div>`;
    }

    // Detailed feedback
    if (s.detailed_feedback) {
      html += `
        <div class="feedback-section">
          <h3>Detailed Feedback</h3>
          <div class="feedback-text">${escHtml(s.detailed_feedback)}</div>
        </div>`;
    }

    // Strengths
    const strengths = parseList(s.strengths);
    if (strengths.length) {
      html += `
        <div class="feedback-section">
          <h3>Strengths</h3>
          <ul class="list-items strengths-list">${strengths.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>
        </div>`;
    }

    // Improvements (simple list — old style)
    const improvements = parseList(s.improvements);
    if (improvements.length && !overallImprovData) {
      html += `
        <div class="feedback-section">
          <h3>Areas for Improvement</h3>
          <ul class="list-items improvements-list">${improvements.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>
        </div>`;
    }
  }

  // Original essay (with inline annotations if any)
  const feedbackAnnotations = s.annotations && Array.isArray(s.annotations) && s.annotations.length > 0 ? s.annotations : null;
  if (feedbackAnnotations) {
    // Render annotated essay with colored marks (read-only)
    html += `
      <div class="feedback-section">
        <h3>Your Essay <span style="font-size:.75rem;font-weight:400;color:var(--gray-500)">(teacher annotations shown)</span></h3>
        <div class="annotation-legend">
          <span class="ann-type grammar">Grammar</span>
          <span class="ann-type vocabulary">Vocabulary</span>
          <span class="ann-type argument">Argument</span>
          <span class="ann-type structure">Structure</span>
          <span class="ann-type strength">Strength</span>
        </div>
        <div class="essay-box annotated-essay-view" id="annotated-essay-view"></div>
      </div>`;
  } else {
    html += `
      <div class="feedback-section">
        <h3>Your Essay</h3>
        <div class="essay-box">${escHtml(s.essay)}</div>
      </div>`;
  }

  // Teacher comments (visible to student)
  const comments = Array.isArray(s.comments) ? s.comments : [];
  if (comments.length > 0) {
    html += `
      <div class="feedback-section teacher-comments-section">
        <h3>💬 Teacher Comments</h3>
        <div class="teacher-comments-list">
          ${comments.map(c => `
            <div class="teacher-comment">
              <div class="tc-meta">
                <span class="tc-author">👨‍🏫 ${escHtml(c.teacher_name || 'Teacher')}</span>
                <span class="tc-date">${formatDate(c.created_at)}</span>
              </div>
              <div class="tc-text">${escHtml(c.text)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // Rewrite button — available as soon as the essay exists (don't require grading first)
  if (s.essay && s.status !== 'error') {
    html += `
      <div class="rewrite-cta">
        <div class="rewrite-cta-text">
          <strong>✨ Want to see a Band 8+ version?</strong>
          <span>AI will rewrite your essay with higher vocabulary, better structure, and improved grammar — plus explain every change.</span>
        </div>
        <button class="btn btn-rewrite" onclick="viewRewrite(${s.id})">🔄 AI Rewrite at Band 8+</button>
      </div>`;
  }

  document.getElementById('feedback-content').innerHTML = html;

  // Render annotated essay read-only view (must be after DOM update)
  if (feedbackAnnotations) {
    const annViewEl = document.getElementById('annotated-essay-view');
    if (annViewEl) renderAnnotatedEssay(annViewEl, s.essay, feedbackAnnotations, true);
  }

  // Draw radar chart after DOM update
  if (s.status === 'graded' && s.overall_band != null) {
    const radarCtx = document.getElementById('feedback-radar-chart');
    if (radarCtx && window.Chart) {
      const taLabel = s.task_type === 'task1' ? 'TA' : 'TR';
      new Chart(radarCtx, {
        type: 'radar',
        data: {
          labels: [taLabel, 'CC', 'LR', 'GRA'],
          datasets: [{
            label: 'Band Score',
            data: [s.task_achievement, s.coherence_cohesion, s.lexical_resource, s.grammatical_range],
            backgroundColor: 'rgba(245,158,11,0.2)',
            borderColor: '#F59E0B',
            pointBackgroundColor: '#F59E0B',
            borderWidth: 2,
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          scales: {
            r: {
              min: 0, max: 9,
              ticks: { stepSize: 1, display: false },
              grid: { color: 'rgba(0,0,0,.1)' },
              pointLabels: { font: { size: 13, weight: 'bold' } }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }
}

function highlightSentences(essayText, sentenceAnalysis) {
  const parsed = typeof sentenceAnalysis === 'string' ? JSON.parse(sentenceAnalysis) : (sentenceAnalysis || []);
  if (!parsed.length) return escHtml(essayText);
  // Split essay into sentences
  const sentenceRegex = /[^.!?]*[.!?]+["']?/g;
  const sentences = essayText.match(sentenceRegex) || [essayText];
  return sentences.map((sentence, idx) => {
    const analysis = parsed.find(a => a.i === idx + 1);
    const type = analysis ? analysis.t : 'uncertain';
    return `<span class="sent-${type}" title="${type}">${escHtml(sentence)}</span>`;
  }).join('');
}

function toggleCriterion(key) {
  const card = document.getElementById(`crit-${key}`);
  if (card) card.classList.toggle('collapsed');
}

function bandItem(score, label) {
  return `
    <div class="band-item">
      <div class="band-item-score ${bandColor(score)}">${score != null ? score : '–'}</div>
      <div class="band-item-label">${label}</div>
    </div>`;
}

function parseList(val) {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [String(p)]; } catch { return [val]; }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Rewrite ─────────────────────────────────────────────────────────────── */
let currentRewriteSubmissionId = null;

async function viewRewrite(submissionId) {
  currentRewriteSubmissionId = submissionId;
  showView('rewrite');
  // Keep history nav active so back button is intuitive
  document.getElementById('nav-history').classList.add('active');

  // Store original essay for diff view
  window._rewriteOriginalEssay = '';
  try {
    const sub = await api(`/api/submissions/${submissionId}`);
    window._rewriteOriginalEssay = sub.essay || '';
  } catch {}

  const contentEl = document.getElementById('rewrite-content');
  contentEl.innerHTML = '<div class="loading">✍ AI is rewriting your essay at Band 8+… This may take 15–20 seconds.</div>';

  let raw = '';
  try {
    await streamSSE(
      '/api/rewrite',
      { submission_id: submissionId },
      (chunk) => {
        raw += chunk;
        contentEl.innerHTML = renderRewriteMarkdown(raw);
      },
      () => {
        contentEl.innerHTML = renderRewriteMarkdown(raw);
      }
    );
  } catch (err) {
    contentEl.innerHTML = `<div class="empty-state">Rewrite failed: ${escHtml(err.message)}</div>`;
  }
}

function renderRewriteMarkdown(text) {
  // Split at "## What Changed" boundary
  const parts = text.split(/^## What Changed\s*$/m);
  let html = '';

  if (parts.length >= 2) {
    // Essay part
    const essayText = parts[0].trim();

    // Show diff toggle bar
    const originalEssay = (() => {
      try {
        const sub = window._rewriteOriginalEssay || '';
        return sub;
      } catch { return ''; }
    })();

    html += `<div class="feedback-section">`;
    html += `<div class="diff-toggle-bar">`;
    html += `<h3 style="margin:0">Rewritten Essay <span class="band-chip band-8">Target: Band 8+</span></h3>`;
    if (originalEssay) {
      html += `<button class="btn btn-secondary btn-sm" onclick="toggleDiffView(this)" data-mode="diff">📄 Plain View</button>`;
    }
    html += `</div>`;

    // Diff view (shown by default when original available)
    if (originalEssay) {
      const diffHtml = buildWordDiff(originalEssay, essayText);
      html += `<div class="essay-diff-container rewrite-diff-view" id="rewrite-diff-view">
        <div class="essay-diff-panel">
          <h4>Original</h4>
          <div class="diff-original">${diffHtml.original}</div>
        </div>
        <div class="essay-diff-panel">
          <h4>Rewritten</h4>
          <div class="diff-rewritten">${diffHtml.rewritten}</div>
        </div>
      </div>`;
    }

    // Plain view (hidden initially when diff available)
    html += `<div class="rewrite-essay-box${originalEssay ? ' hidden' : ''}" id="rewrite-plain-view">${escHtml(essayText)}</div>`;

    html += `</div>`;

    // What Changed part
    const changesText = parts[1].trim();
    const changesHtml = escHtml(changesText)
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html += `<div class="feedback-section what-changed-section">`;
    html += `<h3>📝 What Changed</h3>`;
    html += `<ul class="what-changed-list">${changesHtml}</ul>`;
    html += `</div>`;
  } else {
    // Still streaming — show essay text as-is
    const safeText = escHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html += `<div class="feedback-section"><h3>Rewritten Essay <span class="band-chip band-8">Target: Band 8+</span></h3>`;
    html += `<div class="rewrite-essay-box">${safeText}</div></div>`;
  }

  return html;
}

function toggleDiffView(btn) {
  const plain = document.getElementById('rewrite-plain-view');
  const diff = document.getElementById('rewrite-diff-view');
  if (!plain || !diff) return;
  if (btn.dataset.mode === 'diff') {
    // currently showing diff → switch to plain
    diff.classList.add('hidden');
    plain.classList.remove('hidden');
    btn.dataset.mode = 'plain';
    btn.textContent = '⇔ Compare';
  } else {
    // currently showing plain → switch to diff
    plain.classList.add('hidden');
    diff.classList.remove('hidden');
    btn.dataset.mode = 'diff';
    btn.textContent = '📄 Plain View';
  }
}

// LCS-based word-level diff — returns { original: html, rewritten: html }
function buildWordDiff(original, rewritten) {
  // Tokenize preserving whitespace tokens
  const tokA = original.split(/(\s+)/);
  const tokB = rewritten.split(/(\s+)/);
  const m = tokA.length, n = tokB.length;

  // Build LCS DP table (space-optimised: only two rows needed but full table for traceback)
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (tokA[i] === tokB[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] > dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  // Traceback to build annotated output
  let i = 0, j = 0, outA = '', outB = '';
  while (i < m || j < n) {
    if (i < m && j < n && tokA[i] === tokB[j]) {
      outA += escHtml(tokA[i]);
      outB += escHtml(tokB[j]);
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      // Token only in rewritten — insertion
      if (!tokB[j].trim()) { outB += escHtml(tokB[j]); }
      else { outB += `<ins>${escHtml(tokB[j])}</ins>`; }
      j++;
    } else {
      // Token only in original — deletion
      if (!tokA[i].trim()) { outA += escHtml(tokA[i]); }
      else { outA += `<del>${escHtml(tokA[i])}</del>`; }
      i++;
    }
  }

  return { original: outA, rewritten: outB };
}

/* ─── Mock Tests — List View ─────────────────────────────────────────────── */
let currentTestTab = 'reading';

function switchTestTab(type) {
  currentTestTab = type;
  document.getElementById('test-tab-reading').classList.toggle('active', type === 'reading');
  document.getElementById('test-tab-listening').classList.toggle('active', type === 'listening');
  renderTestList();
}

let _testListCache = null;

async function loadTestList() {
  const el = document.getElementById('test-list-content');
  el.innerHTML = '<div class="loading">Loading tests…</div>';
  try {
    _testListCache = await api('/api/tests');
    renderTestList();
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderTestList() {
  const el = document.getElementById('test-list-content');
  if (!_testListCache) return;
  const filtered = _testListCache.filter(t => t.type === currentTestTab);
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state">No ${currentTestTab} tests available yet.</div>`;
    return;
  }
  el.innerHTML = filtered.map(t => {
    const timeMins = t.type === 'reading' ? 60 : 30;
    let actionBtn = '';
    if (t.user_status === 'in_progress') {
      actionBtn = `<button class="btn btn-warning btn-sm" onclick="startTest(${t.id})">▶ Resume</button>`;
    } else if (t.user_status === 'completed') {
      actionBtn = `
        <button class="btn btn-secondary btn-sm" onclick="viewTestResult(${t.latest_attempt_id})">📊 View Result</button>
        <button class="btn btn-primary btn-sm" onclick="startTest(${t.id})">Retry</button>`;
    } else {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="startTest(${t.id})">▶ Start Test</button>`;
    }
    const bandBadge = t.latest_band != null
      ? `<span class="band-badge" style="background:${bandColor(t.latest_band)};color:#fff">Band ${t.latest_band}</span>`
      : '';
    return `
      <div class="test-card">
        <div class="test-card-info">
          <div class="test-card-title">${escHtml(t.title)}</div>
          <div class="test-card-meta">${t.section_count} sections · ${t.question_count} questions · ${timeMins} min ${bandBadge}</div>
        </div>
        <div class="test-card-actions">${actionBtn}</div>
      </div>`;
  }).join('');
}

/* ─── Mock Tests — Taking ────────────────────────────────────────────────── */
let currentTestData = null;
let currentAttemptId = null;
let currentAnswers = {};
let currentTestType = null;
let testTimerInterval = null;
let testTimeRemaining = 0;
let currentSectionIndex = 0;
let autosaveInterval = null;

async function startTest(testId) {
  try {
    const data = await api(`/api/tests/${testId}/start`, { method: 'POST' });
    currentTestData = data.test;
    currentAttemptId = data.attempt_id;
    currentAnswers = data.answers || {};
    currentTestType = data.test.type;
    testTimeRemaining = data.time_remaining_secs;
    currentSectionIndex = 0;
    showView('test-taking');
    renderTestTaking();
    startTestTimer();
    startAutosave(testId);
    initTestResizer();
  } catch (err) {
    alert('Failed to start test: ' + err.message);
  }
}

function initTestResizer() {
  const resizer  = document.getElementById('test-resizer');
  const leftPanel  = document.getElementById('test-left-panel');
  const rightPanel = document.getElementById('test-right-panel');
  if (!resizer || !leftPanel || !rightPanel) return;

  // Reset any previous inline sizing so flex defaults take over fresh
  leftPanel.style.flex  = '';
  leftPanel.style.width = '';

  let startX, startLeftWidth;

  resizer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e) {
    const dx = e.clientX - startX;
    const newWidth = startLeftWidth + dx;
    const bodyWidth = resizer.parentElement.getBoundingClientRect().width;
    const min = 280;
    const max = bodyWidth - 280 - 6; // 6px = resizer width
    if (newWidth >= min && newWidth <= max) {
      leftPanel.style.flex  = 'none';
      leftPanel.style.width = newWidth + 'px';
    }
  }

  function onUp() {
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}

function renderTestTaking() {
  const test = currentTestData;
  document.getElementById('test-taking-title').textContent = escHtml(test.title);

  // Section tabs
  const tabsEl = document.getElementById('test-section-tabs');
  tabsEl.innerHTML = (test.sections || []).map((s, i) =>
    `<button class="section-tab-btn ${i === currentSectionIndex ? 'active' : ''}" onclick="switchTestSection(${i})">
      ${test.type === 'reading' ? 'Passage' : 'Section'} ${s.section_number}
    </button>`
  ).join('');

  renderTestSection();
  renderQNav();
}

function switchTestSection(idx) {
  currentSectionIndex = idx;
  document.querySelectorAll('.section-tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  renderTestSection();
  renderQNav();
}

function renderTestSection() {
  const section = currentTestData.sections[currentSectionIndex];
  const leftEl = document.getElementById('test-left-panel');
  const rightEl = document.getElementById('test-right-panel');

  // Left: passage or audio
  if (currentTestType === 'reading') {
    leftEl.innerHTML = `
      <div class="passage-title">${escHtml(section.passage_title || `Passage ${section.section_number}`)}</div>
      <div class="passage-text">${escHtml(section.passage_text || '').replace(/\n/g, '<br>')}</div>`;
  } else {
    const audioHtml = section.audio_url
      ? `<div class="audio-player-container">
           <p class="audio-label">🎧 Audio — Section ${section.section_number}</p>
           <audio controls src="${escHtml(section.audio_url)}" class="audio-player"></audio>
         </div>`
      : `<div class="audio-missing">No audio URL provided for this section.</div>`;
    const transcriptHtml = section.transcript
      ? `<details class="transcript-details"><summary>Show Transcript</summary><div class="transcript-text">${escHtml(section.transcript).replace(/\n/g,'<br>')}</div></details>`
      : '';
    leftEl.innerHTML = audioHtml + transcriptHtml;
  }

  // Right: question navigator + questions
  renderQNav();
  renderQuestions(section);
}

function renderQNav() {
  const navEl = document.getElementById('q-nav-grid');
  const section = currentTestData.sections[currentSectionIndex];
  const items = [];
  for (const q of (section.questions || [])) {
    if (q.q_type === 'matching' && q.sub_questions) {
      q.sub_questions.forEach((sq, idx) => {
        const key = `${q.q_number}_${sq.label}`;
        // Extract leading number from label if present (e.g. "3 Some description" → "3"), else fall back to q_number+idx
        const numMatch = sq.label.match(/^(\d+)/);
        const display = numMatch ? numMatch[1] : String(q.q_number + idx);
        items.push({ key, display });
      });
    } else {
      items.push({ key: String(q.q_number), display: String(q.q_number) });
    }
  }
  navEl.innerHTML = items.map(({ key, display }) =>
    `<button class="q-nav-btn ${currentAnswers[key] ? 'answered' : ''}" onclick="scrollToQuestion('${key.replace(/'/g, "\\'")}')">${display}</button>`
  ).join('');
}

function renderQuestions(section) {
  const container = document.getElementById('test-questions-container');
  const questions = section.questions || [];

  // Group consecutive questions by type so we can show group headers
  const groups = [];
  questions.forEach(q => {
    const last = groups[groups.length - 1];
    if (last && last.type === q.q_type) {
      last.questions.push(q);
    } else {
      groups.push({ type: q.q_type, questions: [q] });
    }
  });

  container.innerHTML = groups.map(g => {
    const nums = g.questions.map(q => q.q_number);
    const min = Math.min(...nums), max = Math.max(...nums);
    const rangeLabel = min === max ? `Question ${min}` : `Questions ${min}–${max}`;

    let desc = '';
    if (g.type === 'tfng') {
      desc = 'Write <strong>TRUE</strong> if the statement agrees with the information, <strong>FALSE</strong> if the statement contradicts the information, or <strong>NOT GIVEN</strong> if there is no information on this.';
    } else if (g.type === 'mcq') {
      desc = 'Choose the correct letter, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.';
    } else if (g.type === 'fill') {
      desc = 'Complete the sentences. Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.';
    } else if (g.type === 'matching') {
      // Use the stem of the first matching question as the group description
      desc = escHtml(g.questions[0]?.stem || '');
    }

    return `<div class="q-group">
      <div class="q-group-header">
        <div class="q-group-title">${rangeLabel}:</div>
        ${desc ? `<div class="q-group-desc">${desc}</div>` : ''}
      </div>
      <div class="q-group-body">${g.questions.map(q => renderQuestion(q, g.type)).join('')}</div>
    </div>`;
  }).join('');
}

function renderQuestion(q, groupType) {
  const saved = currentAnswers[q.q_number] || '';
  const type  = groupType || q.q_type;

  // ── TFNG: horizontal row [circle] [select] [statement] ─────────────────────
  if (type === 'tfng') {
    return `<div class="question-block tfng-block" id="qblock_${q.q_number}">
      <div class="tfng-row">
        <span class="q-num-circle">${q.q_number}</span>
        <select class="tfng-select" onchange="setAnswer('${q.q_number}',this.value)">
          <option value=""  ${!saved            ? 'selected' : ''}>—</option>
          <option value="TRUE"      ${saved === 'TRUE'      ? 'selected' : ''}>TRUE</option>
          <option value="FALSE"     ${saved === 'FALSE'     ? 'selected' : ''}>FALSE</option>
          <option value="NOT GIVEN" ${saved === 'NOT GIVEN' ? 'selected' : ''}>NOT GIVEN</option>
        </select>
        <span class="tfng-statement">${escHtml(q.stem)}</span>
      </div>
    </div>`;
  }

  // ── FILL: inline blank inside sentence ─────────────────────────────────────
  if (type === 'fill') {
    const stemWithInput = escHtml(q.stem).replace(
      /___/g,
      `<input type="text" class="q-fill-input" placeholder="…" value="${escHtml(saved)}" oninput="setAnswer('${q.q_number}',this.value)">`
    );
    return `<div class="question-block" id="qblock_${q.q_number}">
      <div class="q-stem"><span class="q-num-circle">${q.q_number}</span> ${stemWithInput}</div>
    </div>`;
  }

  // ── MATCHING ────────────────────────────────────────────────────────────────
  if (type === 'matching' && q.sub_questions) {
    const opts = Object.entries(q.options || {}).map(([k,v]) =>
      `<option value="${k}">${k}. ${escHtml(v)}</option>`
    ).join('');
    const rows = (q.sub_questions || []).map(sq => {
      const key    = `${q.q_number}_${sq.label}`;
      const sqSaved = currentAnswers[key] || '';
      const optsWithSelected = opts.replace(
        new RegExp(`value="${sqSaved.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`),
        `value="${sqSaved}" selected`
      );
      return `<div class="matching-row">
        <span class="matching-label">${escHtml(sq.label)}</span>
        <select onchange="setAnswer('${key}',this.value)">
          <option value="">– Select –</option>${optsWithSelected}
        </select>
      </div>`;
    }).join('');
    return `<div class="question-block" id="qblock_${q.q_number}">
      ${rows}
    </div>`;
  }

  // ── MCQ (single or multi) ───────────────────────────────────────────────────
  const isMulti = (q.correct_answer && String(q.correct_answer).includes(',')) ||
                  /choose\s+(two|three|four|five|six|\d+)\s+letters/i.test(q.stem || '');
  const savedArr = saved.split(',').map(s => s.trim()).filter(Boolean);
  let inputHtml;
  if (isMulti) {
    inputHtml = Object.entries(q.options || {}).map(([k,v]) =>
      `<label class="q-option"><input type="checkbox" name="q_${q.q_number}" value="${k}" ${savedArr.includes(k)?'checked':''} onchange="setMcqMulti('${q.q_number}',this)"> <strong>${k}.</strong> ${escHtml(v)}</label>`
    ).join('');
  } else {
    inputHtml = Object.entries(q.options || {}).map(([k,v]) =>
      `<label class="q-option"><input type="radio" name="q_${q.q_number}" value="${k}" ${saved===k?'checked':''} onchange="setAnswer('${q.q_number}',this.value)"> <strong>${k}.</strong> ${escHtml(v)}</label>`
    ).join('');
  }
  return `<div class="question-block" id="qblock_${q.q_number}">
    <div class="q-stem"><span class="q-num-circle">${q.q_number}</span> ${escHtml(q.stem)}</div>
    <div class="q-inputs">${inputHtml}</div>
  </div>`;
}

function setAnswer(key, value) {
  currentAnswers[key] = value;
  // Update nav button
  const navBtn = document.querySelector(`.q-nav-btn[onclick*="'${key}'"]`);
  if (navBtn) navBtn.classList.toggle('answered', !!value);
}

function setMcqMulti(qNum, checkbox) {
  const checked = [...document.querySelectorAll(`input[name="q_${qNum}"]:checked`)]
    .map(cb => cb.value);
  setAnswer(String(qNum), checked.join(','));
}

function scrollToQuestion(key) {
  const baseKey = key.includes('_') ? key.split('_')[0] : key;
  const el = document.getElementById(`qblock_${baseKey}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startTestTimer() {
  clearInterval(testTimerInterval);
  updateTimerDisplay();
  testTimerInterval = setInterval(() => {
    testTimeRemaining--;
    updateTimerDisplay();
    if (testTimeRemaining <= 0) {
      clearInterval(testTimerInterval);
      alert('⏰ Time is up! Your test will be submitted automatically.');
      submitTest();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('test-timer');
  if (!el) return;
  const mins = Math.floor(testTimeRemaining / 60);
  const secs = testTimeRemaining % 60;
  el.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  el.classList.toggle('timer-warning', testTimeRemaining <= 300);
}

function startAutosave(testId) {
  clearInterval(autosaveInterval);
  autosaveInterval = setInterval(async () => {
    if (!currentAttemptId) return;
    try {
      await api(`/api/tests/${testId}/attempts/${currentAttemptId}/autosave`, {
        method: 'PUT',
        body: JSON.stringify({ answers: currentAnswers, time_remaining_secs: testTimeRemaining })
      });
    } catch (e) { /* silent */ }
  }, 30000);
}

async function submitTest() {
  clearInterval(testTimerInterval);
  clearInterval(autosaveInterval);
  if (!currentAttemptId || !currentTestData) return;
  try {
    const result = await api(`/api/tests/${currentTestData.id}/attempts/${currentAttemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers: currentAnswers, time_remaining_secs: testTimeRemaining })
    });
    // Navigate to result view
    viewTestResult(result.attempt_id || currentAttemptId);
  } catch (err) {
    alert('Submit failed: ' + err.message);
  }
}

/* ─── Mock Tests — Result View ───────────────────────────────────────────── */
let resultPollingInterval = null;

async function viewTestResult(attemptId) {
  clearInterval(resultPollingInterval);
  showView('test-result');
  document.getElementById('test-result-content').innerHTML = '<div class="loading">Loading results…</div>';
  await fetchAndRenderResult(attemptId);
}

async function fetchAndRenderResult(attemptId) {
  try {
    const attempt = await api(`/api/tests/attempts/${attemptId}`);
    document.getElementById('test-result-title').textContent = attempt.test ? escHtml(attempt.test.title) : 'Test Result';
    renderTestResult(attempt);

    // Poll for AI explanations if not yet available
    if (attempt.status === 'completed' && attempt.score && !attempt.ai_explanations &&
        attempt.score.wrong_q_numbers && attempt.score.wrong_q_numbers.length > 0) {
      clearInterval(resultPollingInterval);
      resultPollingInterval = setInterval(async () => {
        const updated = await api(`/api/tests/attempts/${attemptId}`).catch(() => null);
        if (updated && updated.ai_explanations) {
          clearInterval(resultPollingInterval);
          renderTestResult(updated);
        }
      }, 4000);
    }
  } catch (err) {
    document.getElementById('test-result-content').innerHTML =
      `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderTestResult(attempt) {
  const el = document.getElementById('test-result-content');
  if (!attempt.score) {
    el.innerHTML = '<div class="loading">Scoring…</div>';
    return;
  }
  const { score } = attempt;
  const bandHtml = `
    <div class="result-score-card">
      <div class="result-band" style="color:${bandColor(score.band)}">${score.band}</div>
      <div class="result-band-label">Band Score</div>
      <div class="result-raw">${score.raw} / ${score.total} correct</div>
    </div>`;

  const sectionHtml = (score.section_scores || []).map(s =>
    `<div class="result-section-row">
      <span>${attempt.type === 'reading' ? 'Passage' : 'Section'} ${s.section_number}</span>
      <span>${s.correct} / ${s.total}</span>
    </div>`
  ).join('');

  // Full question review
  let reviewHtml = '';
  if (attempt.test) {
    for (const section of (attempt.test.sections || [])) {
      for (const q of (section.questions || [])) {
        if (q.q_type === 'matching' && q.sub_questions) {
          for (const sq of q.sub_questions) {
            const key = `${q.q_number}_${sq.label}`;
            const given = attempt.answers[key] || '(blank)';
            const correct = sq.correct_answer;
            const isCorrect = given.trim().toUpperCase() === (correct || '').trim().toUpperCase();
            const expl = attempt.ai_explanations && attempt.ai_explanations[key];
            reviewHtml += questionReviewHtml(key, `${escHtml(q.stem)} — "${escHtml(sq.label)}"`, given, correct, isCorrect, expl);
          }
        } else {
          const key = String(q.q_number);
          const given = attempt.answers[key] || '(blank)';
          const correct = q.correct_answer;
          const alts = q.accept_alternatives || [];
          const isCorrect = given.trim().toLowerCase() === (correct||'').trim().toLowerCase() ||
            alts.map(a=>a.toLowerCase()).includes(given.trim().toLowerCase());
          const expl = attempt.ai_explanations && attempt.ai_explanations[key];
          reviewHtml += questionReviewHtml(key, escHtml(q.stem), given, correct, isCorrect, expl);
        }
      }
    }
  }

  const explNote = !attempt.ai_explanations && score.wrong_q_numbers && score.wrong_q_numbers.length
    ? `<div class="expl-loading-note">⏳ Explanations are being generated… check back in a few seconds.</div>`
    : '';

  el.innerHTML = `
    ${bandHtml}
    <div class="result-sections">
      <h3>Section Breakdown</h3>
      ${sectionHtml}
    </div>
    ${reviewHtml ? `<div class="result-review"><h3>Question Review</h3>${explNote}${reviewHtml}</div>` : ''}`;
}

function questionReviewHtml(key, stemHtml, given, correct, isCorrect, explanation) {
  const cls = isCorrect ? 'correct' : 'wrong';
  const icon = isCorrect ? '✅' : '❌';
  const corrPart = !isCorrect ? `<span class="correct-answer">Correct: <strong>${escHtml(correct || '')}</strong></span>` : '';
  const explPart = explanation ? `<div class="ai-explanation-box">💡 ${escHtml(explanation)}</div>` : '';
  return `<div class="question-result ${cls}">
    <div class="q-result-header">${icon} <strong>Q${key}</strong>: ${stemHtml}</div>
    <div class="q-result-answer">Your answer: <em>${escHtml(given)}</em> ${corrPart}</div>
    ${explPart}
  </div>`;
}

/* ─── Mock Tests — History ───────────────────────────────────────────────── */
async function loadTestHistory() {
  const el = document.getElementById('test-history-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const attempts = await api('/api/tests/attempts');
    if (!attempts.length) {
      el.innerHTML = '<div class="empty-state">No test attempts yet. <a href="#" onclick="showView(\'test-list\')">Take a mock test!</a></div>';
      return;
    }
    el.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Test</th><th>Type</th><th>Date</th><th>Raw Score</th><th>Band</th><th></th></tr></thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td>${escHtml(a.test_title)}</td>
                <td><span class="badge ${a.type==='reading'?'badge-blue':'badge-orange'}">${a.type}</span></td>
                <td>${a.submitted_at ? formatDate(a.submitted_at) : formatDate(a.started_at)}</td>
                <td>${a.score ? `${a.score.raw}/${a.score.total}` : '–'}</td>
                <td>${a.score ? `<span style="color:${bandColor(a.score.band)};font-weight:700">${a.score.band}</span>` : '–'}</td>
                <td>${a.status==='completed' ? `<button class="btn btn-secondary btn-xs" onclick="viewTestResult(${a.id})">View</button>` : '<span class="badge badge-gray">In Progress</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

/* ─── Admin Materials ────────────────────────────────────────────────────── */
let currentMaterialsTab = 'reading';
let _materialsCache = null;

function switchMaterialsTab(type) {
  currentMaterialsTab = type;
  ['reading','listening','task1','speaking','task2'].forEach(t => {
    const btn = document.getElementById(`materials-tab-${t}`);
    if (btn) btn.classList.toggle('active', t === type);
  });

  const task1Panel        = document.getElementById('task1-topics-panel');
  const speakingPanel     = document.getElementById('speaking-topics-panel');
  const task2Panel        = document.getElementById('task2-prompts-panel');
  const listContent       = document.getElementById('materials-list-content');
  const actionTabs        = document.querySelector('.materials-action-tabs');
  const createPanel       = document.getElementById('mat-panel-create');
  const importPanel       = document.getElementById('mat-panel-import');

  // Hide all special panels first
  [task1Panel, speakingPanel, task2Panel].forEach(p => p && p.classList.add('hidden'));

  if (type === 'task1') {
    if (task1Panel) task1Panel.classList.remove('hidden');
    if (listContent) listContent.classList.add('hidden');
    if (actionTabs) actionTabs.classList.add('hidden');
    if (createPanel) createPanel.classList.add('hidden');
    if (importPanel) importPanel.classList.add('hidden');
    loadTask1Topics();
  } else if (type === 'speaking') {
    if (speakingPanel) speakingPanel.classList.remove('hidden');
    if (listContent) listContent.classList.add('hidden');
    if (actionTabs) actionTabs.classList.add('hidden');
    if (createPanel) createPanel.classList.add('hidden');
    if (importPanel) importPanel.classList.add('hidden');
    loadAdminSpeakingTopics();
  } else if (type === 'task2') {
    if (task2Panel) task2Panel.classList.remove('hidden');
    if (listContent) listContent.classList.add('hidden');
    if (actionTabs) actionTabs.classList.add('hidden');
    if (createPanel) createPanel.classList.add('hidden');
    if (importPanel) importPanel.classList.add('hidden');
    loadAdminTask2Prompts();
  } else {
    if (listContent) listContent.classList.remove('hidden');
    if (actionTabs) actionTabs.classList.remove('hidden');
    renderMaterialsList();
    if (createPanel) createPanel.classList.add('hidden');
    buildSectionsForm();
  }
}

/* ─── Admin Speaking Topics ──────────────────────────────────────────────── */
function toggleSpeakingTopicFields() {
  const bank = document.getElementById('st-bank')?.value;
  const partGroup = document.getElementById('st-part-group');
  if (partGroup) partGroup.style.display = bank === 'ielts' ? '' : 'none';
}

async function loadAdminSpeakingTopics() {
  const list = document.getElementById('admin-speaking-topics-list');
  if (!list) return;
  list.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const topics = await api('/api/admin/speaking-topics');
    if (!topics.length) { list.innerHTML = '<div class="empty-state">No custom speaking topics yet.</div>'; return; }
    list.innerHTML = `
      <h4 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary)">Custom Topics (${topics.length})</h4>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Bank</th><th>Part/Cat</th><th>Difficulty</th><th>Question</th><th></th></tr></thead>
          <tbody>${topics.map(t => `
            <tr>
              <td><span class="badge ${t.bank==='impromptu'?'badge-orange':'badge-blue'}">${t.bank}</span></td>
              <td>${t.bank==='ielts'?`Part ${t.part} · `:''}<em>${escHtml(t.cat||'')}</em></td>
              <td><span class="badge badge-gray">${t.difficulty}</span></td>
              <td style="max-width:320px;white-space:normal">${escHtml(t.q)}</td>
              <td><button class="btn btn-danger btn-xs" onclick="deleteAdminSpeakingTopic(${t.id})">Delete</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    list.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

async function submitAddSpeakingTopic() {
  const bank = document.getElementById('st-bank')?.value || 'ielts';
  const part = document.getElementById('st-part')?.value || '1';
  const cat  = document.getElementById('st-cat')?.value?.trim() || 'General';
  const diff = document.getElementById('st-diff')?.value || 'medium';
  const q    = document.getElementById('st-q')?.value?.trim();
  const errEl = document.getElementById('st-error');
  const okEl  = document.getElementById('st-success');
  if (errEl) errEl.classList.add('hidden');
  if (okEl)  okEl.classList.add('hidden');
  if (!q) { if (errEl) { errEl.textContent = 'Question text is required.'; errEl.classList.remove('hidden'); } return; }
  try {
    await api('/api/admin/speaking-topics', { method: 'POST', body: JSON.stringify({ bank, part, cat, difficulty: diff, q }) });
    if (okEl) { okEl.textContent = '✓ Topic added!'; okEl.classList.remove('hidden'); setTimeout(() => okEl.classList.add('hidden'), 3000); }
    document.getElementById('st-q').value = '';
    document.getElementById('st-cat').value = '';
    window._customSpeakingTopics = null; // invalidate cache
    loadAdminSpeakingTopics();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}

async function deleteAdminSpeakingTopic(id) {
  if (!confirm('Delete this speaking topic?')) return;
  try {
    await api(`/api/admin/speaking-topics/${id}`, { method: 'DELETE' });
    window._customSpeakingTopics = null;
    loadAdminSpeakingTopics();
  } catch (err) { alert('Failed to delete: ' + err.message); }
}

/* ─── Admin Task 2 Prompts ───────────────────────────────────────────────── */
async function loadAdminTask2Prompts() {
  const list = document.getElementById('admin-task2-prompts-list');
  if (!list) return;
  list.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const prompts = await api('/api/admin/task2-prompts');
    if (!prompts.length) { list.innerHTML = '<div class="empty-state">No custom Task 2 prompts yet.</div>'; return; }
    list.innerHTML = `
      <h4 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary)">Custom Prompts (${prompts.length})</h4>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Difficulty</th><th>Prompt</th><th></th></tr></thead>
          <tbody>${prompts.map(p => `
            <tr>
              <td><span class="badge badge-gray">${p.difficulty}</span></td>
              <td style="max-width:400px;white-space:normal">${escHtml(p.q)}</td>
              <td><button class="btn btn-danger btn-xs" onclick="deleteAdminTask2Prompt(${p.id})">Delete</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    list.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

async function submitAddTask2Prompt() {
  const diff = document.getElementById('t2p-diff')?.value || 'medium';
  const q    = document.getElementById('t2p-q')?.value?.trim();
  const errEl = document.getElementById('t2p-error');
  const okEl  = document.getElementById('t2p-success');
  if (errEl) errEl.classList.add('hidden');
  if (okEl)  okEl.classList.add('hidden');
  if (!q) { if (errEl) { errEl.textContent = 'Prompt text is required.'; errEl.classList.remove('hidden'); } return; }
  try {
    await api('/api/admin/task2-prompts', { method: 'POST', body: JSON.stringify({ difficulty: diff, q }) });
    if (okEl) { okEl.textContent = '✓ Prompt added!'; okEl.classList.remove('hidden'); setTimeout(() => okEl.classList.add('hidden'), 3000); }
    document.getElementById('t2p-q').value = '';
    window._customTask2Prompts = null;
    loadAdminTask2Prompts();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}

async function deleteAdminTask2Prompt(id) {
  if (!confirm('Delete this Task 2 prompt?')) return;
  try {
    await api(`/api/admin/task2-prompts/${id}`, { method: 'DELETE' });
    window._customTask2Prompts = null;
    loadAdminTask2Prompts();
  } catch (err) { alert('Failed to delete: ' + err.message); }
}

async function loadAdminMaterials() {
  // Default to listening tab on fresh load
  if (currentMaterialsTab === 'task1') currentMaterialsTab = 'listening';
  // Ensure task1 panel is hidden on fresh load
  const task1Panel = document.getElementById('task1-topics-panel');
  if (task1Panel) task1Panel.classList.add('hidden');
  const listContent = document.getElementById('materials-list-content');
  if (listContent) listContent.classList.remove('hidden');
  const actionTabs = document.querySelector('.materials-action-tabs');
  if (actionTabs) actionTabs.classList.remove('hidden');
  // Sync tab buttons
  const tabR = document.getElementById('materials-tab-reading');
  const tabL = document.getElementById('materials-tab-listening');
  const tabT = document.getElementById('materials-tab-task1');
  if (tabR) tabR.classList.toggle('active', currentMaterialsTab === 'reading');
  if (tabL) tabL.classList.toggle('active', currentMaterialsTab === 'listening');
  if (tabT) tabT.classList.remove('active');

  const el = document.getElementById('materials-list-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  try {
    _materialsCache = await api('/api/admin/tests');
    buildSectionsForm();
    renderMaterialsList();
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderMaterialsList() {
  const el = document.getElementById('materials-list-content');
  if (!_materialsCache) return;
  const filtered = (_materialsCache || []).filter(t => t.type === currentMaterialsTab);
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state">No ${currentMaterialsTab} tests yet.</div>`;
    return;
  }
  el.innerHTML = `<div class="materials-list">` + filtered.map(t => `
    <div class="materials-item">
      <div class="materials-item-info">
        <strong>${escHtml(t.title)}</strong>
        <span class="materials-meta">${t.section_count} sections · ${t.question_count} questions</span>
      </div>
      <button class="btn btn-danger btn-xs" onclick="deleteMaterialsTest(${t.id}, '${t.title.replace(/'/g,"\\'")}')">Delete</button>
    </div>`).join('') + `</div>`;
}

async function deleteMaterialsTest(id, title) {
  if (!confirm(`Delete test "${title}" and all its student attempts?`)) return;
  try {
    await api(`/api/admin/tests/${id}`, { method: 'DELETE' });
    _materialsCache = (_materialsCache || []).filter(t => t.id !== id);
    renderMaterialsList();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

/* ─── Task 1 Topics Admin ────────────────────────────────────────────────── */

// State for admin image upload
let _t1AdminImageBase64 = null;
let _t1AdminImageMediaType = null;

function handleT1AdminImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image too large — max 5 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // dataUrl = "data:image/jpeg;base64,/9j/..."
    const [meta, b64] = dataUrl.split(',');
    _t1AdminImageBase64 = b64;
    _t1AdminImageMediaType = meta.replace('data:', '').replace(';base64', '');
    // Show preview
    const preview = document.getElementById('t1-image-preview');
    const area = document.getElementById('t1-image-area');
    const removeBtn = document.getElementById('t1-remove-image-btn');
    if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
    if (area) area.style.borderColor = 'var(--primary)';
    if (removeBtn) removeBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeT1AdminImage() {
  _t1AdminImageBase64 = null;
  _t1AdminImageMediaType = null;
  const preview = document.getElementById('t1-image-preview');
  const area = document.getElementById('t1-image-area');
  const removeBtn = document.getElementById('t1-remove-image-btn');
  const fileInput = document.getElementById('t1-image-input');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  if (area) area.style.borderColor = '';
  if (removeBtn) removeBtn.classList.add('hidden');
  if (fileInput) fileInput.value = '';
}

async function uploadTask1Topic() {
  const chartType = document.getElementById('t1-chart-type')?.value;
  const label = document.getElementById('t1-label')?.value.trim();
  const question = document.getElementById('t1-question')?.value.trim();
  const errEl = document.getElementById('t1-upload-error');
  const successEl = document.getElementById('t1-upload-success');
  const btn = document.querySelector('#task1-topics-panel .btn-primary');

  if (errEl) errEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');

  if (!chartType) { if (errEl) { errEl.textContent = 'Please select a chart type.'; errEl.classList.remove('hidden'); } return; }
  if (!question) { if (errEl) { errEl.textContent = 'Please paste the IELTS question.'; errEl.classList.remove('hidden'); } return; }
  if (!_t1AdminImageBase64) { if (errEl) { errEl.textContent = 'Please upload a chart image.'; errEl.classList.remove('hidden'); } return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
  try {
    await api('/api/admin/task1-topics', {
      method: 'POST',
      body: JSON.stringify({
        chart_type: chartType,
        label: label || '',
        question,
        image_base64: _t1AdminImageBase64,
        image_media_type: _t1AdminImageMediaType,
      }),
    });
    if (successEl) { successEl.textContent = '✅ Topic uploaded successfully!'; successEl.classList.remove('hidden'); }
    // Reset form
    document.getElementById('t1-label').value = '';
    document.getElementById('t1-question').value = '';
    removeT1AdminImage();
    // Reload list
    loadTask1Topics();
  } catch (err) {
    if (errEl) { errEl.textContent = '❌ ' + err.message; errEl.classList.remove('hidden'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Topic'; }
  }
}

async function loadTask1Topics() {
  const listEl = document.getElementById('task1-topics-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading">Loading topics…</div>';
  try {
    const topics = await api('/api/admin/task1-topics');
    renderTask1TopicsList(topics);
  } catch (err) {
    listEl.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderTask1TopicsList(topics) {
  const listEl = document.getElementById('task1-topics-list');
  if (!listEl) return;
  if (!topics || !topics.length) {
    listEl.innerHTML = '<div class="empty-state" style="margin-top:16px">No Task 1 topics uploaded yet.</div>';
    return;
  }

  const TYPE_LABELS = {
    bar_chart: '📊 Bar Chart',
    line_graph: '📈 Line Graph',
    pie_chart: '🥧 Pie Chart',
    table: '📋 Table',
    process_diagram: '⚙️ Process Diagram',
    map: '🗺️ Map',
  };

  // Group by chart_type
  const grouped = {};
  topics.forEach(t => {
    if (!grouped[t.chart_type]) grouped[t.chart_type] = [];
    grouped[t.chart_type].push(t);
  });

  listEl.innerHTML = Object.keys(grouped).map(type => `
    <div class="t1-group">
      <h4 class="t1-group-header">${TYPE_LABELS[type] || type} <span class="badge badge-gray">${grouped[type].length}</span></h4>
      <div class="t1-topics-grid">
        ${grouped[type].map(t => `
          <div class="t1-topic-card">
            <div class="t1-topic-meta">
              <span class="t1-topic-label">${escHtml(t.label || '(no label)')}</span>
              <span class="t1-topic-date">${formatDate(t.created_at)}</span>
            </div>
            <p class="t1-topic-preview">${escHtml(t.question_preview)}</p>
            <div class="t1-topic-actions">
              <button class="btn btn-outline btn-xs" onclick="openEditTopicForm(${t.id})">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="deleteTask1TopicAdmin(${t.id})">Delete</button>
            </div>
            <div class="t1-edit-panel hidden" id="t1-edit-${t.id}"></div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

async function deleteTask1TopicAdmin(id) {
  if (!confirm('Delete this Task 1 topic? Students will no longer see it.')) return;
  try {
    await api(`/api/admin/task1-topics/${id}`, { method: 'DELETE' });
    loadTask1Topics();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

const CHART_TYPE_OPTIONS = [
  ['bar_chart','📊 Bar Chart'],['line_graph','📈 Line Graph'],['pie_chart','🥧 Pie Chart'],
  ['table','📋 Table'],['process_diagram','⚙️ Process Diagram'],['map','🗺️ Map']
];

async function openEditTopicForm(id) {
  const panel = document.getElementById(`t1-edit-${id}`);
  if (!panel) return;
  // Toggle off if already open
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
  panel.innerHTML = '<span class="hint-thinking">Loading…</span>';
  panel.classList.remove('hidden');
  try {
    const t = await api(`/api/admin/task1-topics/${id}`);
    const typeOpts = CHART_TYPE_OPTIONS.map(([v, l]) =>
      `<option value="${v}"${t.chart_type === v ? ' selected' : ''}>${l}</option>`).join('');
    panel.innerHTML = `
      <div class="t1-edit-form">
        <div class="form-group">
          <label class="form-label">Chart Type</label>
          <select id="t1e-type-${id}" class="form-input">${typeOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Label <small>(short admin label)</small></label>
          <input id="t1e-label-${id}" class="form-input" value="${escHtml(t.label || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Question Text</label>
          <textarea id="t1e-question-${id}" class="form-input" rows="4">${escHtml(t.question || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Replace Image <small>(leave blank to keep current)</small></label>
          <input type="file" id="t1e-img-${id}" accept="image/*" class="form-input" onchange="previewEditTopicImage(${id}, this)">
          <img id="t1e-preview-${id}" src="${t.image_base64 ? `data:${t.image_media_type};base64,${t.image_base64}` : ''}" ${t.image_base64 ? '' : 'class="hidden"'} alt="Preview" style="max-width:100%;margin-top:8px;border-radius:8px;display:block;">
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary btn-sm" onclick="saveEditTopic(${id})">💾 Save</button>
          <button class="btn btn-outline btn-sm" onclick="openEditTopicForm(${id})">Cancel</button>
        </div>
        <div id="t1e-err-${id}" class="error-msg hidden" style="margin-top:6px"></div>
      </div>`;
  } catch (err) {
    panel.innerHTML = `<span style="color:var(--danger)">Failed to load: ${escHtml(err.message)}</span>`;
  }
}

async function saveEditTopic(id) {
  const errEl = document.getElementById(`t1e-err-${id}`);
  const chart_type = document.getElementById(`t1e-type-${id}`)?.value;
  const label      = document.getElementById(`t1e-label-${id}`)?.value || '';
  const question   = document.getElementById(`t1e-question-${id}`)?.value || '';
  const imgInput   = document.getElementById(`t1e-img-${id}`);

  if (!question.trim()) { showFieldError(errEl, 'Question text cannot be empty.'); return; }

  const body = { chart_type, question, label };

  // If new image selected, read it as base64
  if (imgInput && imgInput.files && imgInput.files[0]) {
    const file = imgInput.files[0];
    body.image_media_type = file.type;
    body.image_base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  try {
    await api(`/api/admin/task1-topics/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    loadTask1Topics(); // refresh list
  } catch (err) {
    showFieldError(errEl, err.message);
  }
}

function showFieldError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function previewEditTopicImage(id, input) {
  const file = input.files && input.files[0];
  const prev = document.getElementById(`t1e-preview-${id}`);
  if (!file || !prev) return;
  const reader = new FileReader();
  reader.onload = e => {
    prev.src = e.target.result;
    prev.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function toggleCreateTestForm() {
  const form = document.getElementById('mat-panel-create');
  if (!form) return;
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) buildSectionsForm();
}

function buildSectionsForm() {
  const count = currentMaterialsTab === 'reading' ? 3 : 4;
  const container = document.getElementById('sections-container');
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, (_, i) => buildSectionHtml(i + 1)).join('');
}

function buildSectionHtml(num) {
  const isReading = currentMaterialsTab === 'reading';
  const passageOrAudio = isReading
    ? `<div class="form-group">
         <label>Passage Title</label>
         <input type="text" id="sec${num}_title" placeholder="Passage title" />
       </div>
       <div class="form-group">
         <label>Passage Text</label>
         <textarea id="sec${num}_passage" rows="6" placeholder="Paste the full passage text here…"></textarea>
       </div>`
    : `<div class="form-group">
         <label>Audio URL</label>
         <input type="url" id="sec${num}_audio" placeholder="https://..." />
       </div>
       <div class="form-group">
         <label>Transcript (optional)</label>
         <textarea id="sec${num}_transcript" rows="4" placeholder="Paste transcript…"></textarea>
       </div>`;

  return `<div class="section-form-block">
    <div class="section-form-header">
      <h4>${isReading ? 'Passage' : 'Section'} ${num}</h4>
    </div>
    ${passageOrAudio}
    <div id="questions_sec${num}" class="questions-list"></div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addQuestion(${num})">+ Add Question</button>
  </div>`;
}

let questionCounters = {};

function addQuestion(sectionNum) {
  if (!questionCounters[sectionNum]) questionCounters[sectionNum] = 0;
  questionCounters[sectionNum]++;
  const qIdx = questionCounters[sectionNum];
  const container = document.getElementById(`questions_sec${sectionNum}`);
  const div = document.createElement('div');
  div.className = 'question-builder-row';
  div.id = `qbuilder_${sectionNum}_${qIdx}`;
  div.innerHTML = buildQuestionBuilderHtml(sectionNum, qIdx);
  container.appendChild(div);
}

function buildQuestionBuilderHtml(sn, qi) {
  return `<div class="qb-header">
    <span class="qb-num">Q</span>
    <input type="number" id="qnum_${sn}_${qi}" placeholder="Q#" class="qb-num-input" min="1" />
    <select id="qtype_${sn}_${qi}" onchange="updateQuestionFields(${sn},${qi})">
      <option value="mcq">Multiple Choice</option>
      <option value="tfng">True/False/Not Given</option>
      <option value="fill">Fill in Blank</option>
      <option value="matching">Matching</option>
    </select>
    <button class="btn btn-danger btn-xs" onclick="document.getElementById('qbuilder_${sn}_${qi}').remove()">✕</button>
  </div>
  <div id="qfields_${sn}_${qi}">
    ${mcqFieldsHtml(sn, qi)}
  </div>`;
}

function updateQuestionFields(sn, qi) {
  const type = document.getElementById(`qtype_${sn}_${qi}`).value;
  const container = document.getElementById(`qfields_${sn}_${qi}`);
  if (type === 'mcq') container.innerHTML = mcqFieldsHtml(sn, qi);
  else if (type === 'tfng') container.innerHTML = tfngFieldsHtml(sn, qi);
  else if (type === 'fill') container.innerHTML = fillFieldsHtml(sn, qi);
  else if (type === 'matching') container.innerHTML = matchingFieldsHtml(sn, qi);
}

function mcqFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Question Stem</label><input type="text" id="qstem_${sn}_${qi}" placeholder="According to the passage…" /></div>
    <div class="qb-options">
      ${['A','B','C','D'].map(k => `<div class="qb-opt-row"><strong>${k}.</strong><input type="text" id="qopt_${sn}_${qi}_${k}" placeholder="Option ${k}" /></div>`).join('')}
    </div>
    <div class="form-group"><label>Correct Answer</label>
      <select id="qcorrect_${sn}_${qi}"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select>
    </div>`;
}

function tfngFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Statement</label><input type="text" id="qstem_${sn}_${qi}" placeholder="The author believes that…" /></div>
    <div class="form-group"><label>Correct Answer</label>
      <select id="qcorrect_${sn}_${qi}"><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option><option value="NOT GIVEN">NOT GIVEN</option></select>
    </div>`;
}

function fillFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Sentence with blank (use ___ for blank)</label><input type="text" id="qstem_${sn}_${qi}" placeholder="The river flows through ___ before reaching the sea." /></div>
    <div class="form-group"><label>Correct Answer</label><input type="text" id="qcorrect_${sn}_${qi}" placeholder="Answer" /></div>
    <div class="form-group"><label>Accepted Alternatives (comma-separated)</label><input type="text" id="qalts_${sn}_${qi}" placeholder="alt1, alt2" /></div>`;
}

function matchingFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Instruction Stem</label><input type="text" id="qstem_${sn}_${qi}" placeholder="Match each place with a feature." /></div>
    <div class="form-group"><label>Options (one per line, format: A. Description)</label><textarea id="qopts_${sn}_${qi}" rows="4" placeholder="A. Description of A&#10;B. Description of B"></textarea></div>
    <div class="form-group"><label>Sub-questions (one per line, format: Label | Correct Answer Letter)</label><textarea id="qsubs_${sn}_${qi}" rows="3" placeholder="London | A&#10;Paris | B"></textarea></div>`;
}

/* ─── Materials: Action Tab Switcher ─────────────────────────────────────── */
function switchMaterialsAction(tab) {
  const isPanelCreate = tab === 'create';
  document.getElementById('mat-action-tab-create').classList.toggle('active', isPanelCreate);
  document.getElementById('mat-action-tab-import').classList.toggle('active', !isPanelCreate);
  document.getElementById('mat-panel-create').classList.toggle('hidden', !isPanelCreate);
  document.getElementById('mat-panel-import').classList.toggle('hidden', isPanelCreate);
}

/* ─── Materials: JSON Import ─────────────────────────────────────────────── */
function validateImportJson() {
  const raw = document.getElementById('import-json-input').value.trim();
  const resultEl = document.getElementById('import-validation-result');
  resultEl.classList.remove('hidden');

  if (!raw) {
    resultEl.innerHTML = `<div class="import-validation-error">⚠️ Nothing to validate — paste your JSON first.</div>`;
    return false;
  }

  let test;
  try {
    test = JSON.parse(raw);
  } catch (e) {
    resultEl.innerHTML = `<div class="import-validation-error">❌ Invalid JSON syntax: ${escHtml(e.message)}</div>`;
    return false;
  }

  const errors = [];

  if (!test.type || !['reading', 'listening'].includes(test.type)) {
    errors.push('Missing or invalid "type" — must be "reading" or "listening".');
  }
  if (!test.title || typeof test.title !== 'string' || !test.title.trim()) {
    errors.push('Missing or empty "title".');
  }
  if (!Array.isArray(test.sections) || test.sections.length === 0) {
    errors.push('"sections" must be a non-empty array.');
  } else {
    const seenNums = new Set();
    test.sections.forEach((sec, si) => {
      if (!Array.isArray(sec.questions)) {
        errors.push(`Section ${si + 1}: "questions" must be an array.`);
        return;
      }
      sec.questions.forEach((q, qi) => {
        const loc = `Section ${si + 1}, Q${qi + 1}`;
        if (!q.q_number) errors.push(`${loc}: missing "q_number".`);
        else if (seenNums.has(q.q_number)) errors.push(`${loc}: duplicate q_number ${q.q_number}.`);
        else seenNums.add(q.q_number);

        const validTypes = ['mcq', 'tfng', 'fill', 'matching'];
        if (!validTypes.includes(q.q_type)) {
          errors.push(`${loc}: invalid q_type "${q.q_type}". Must be one of: ${validTypes.join(', ')}.`);
        }
        if (q.q_type === 'tfng' && !['TRUE', 'FALSE', 'NOT GIVEN'].includes(q.correct_answer)) {
          errors.push(`${loc}: TFNG correct_answer must be exactly TRUE, FALSE, or NOT GIVEN.`);
        }
        if (q.q_type === 'mcq') {
          if (!q.options || typeof q.options !== 'object' || !Object.keys(q.options).length) {
            errors.push(`${loc}: MCQ questions need an "options" object (e.g. {"A":"...", "B":"..."}).`);
          } else {
            // correct_answer can be a single key ("B") or comma-separated keys ("B,D,G,H")
            const optionKeys = Object.keys(q.options).map(k => k.trim().toUpperCase());
            const answerKeys = String(q.correct_answer).split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
            if (!answerKeys.length) {
              errors.push(`${loc}: MCQ correct_answer is missing.`);
            } else {
              const invalid = answerKeys.filter(k => !optionKeys.includes(k));
              if (invalid.length) {
                errors.push(`${loc}: MCQ correct_answer "${invalid.join(',')}" not found in options.`);
              }
            }
          }
        }
        if (q.q_type === 'matching' && (!Array.isArray(q.sub_questions) || q.sub_questions.length === 0)) {
          errors.push(`${loc}: matching questions must have a "sub_questions" array.`);
        }
      });
    });
  }

  if (errors.length > 0) {
    resultEl.innerHTML = `<div class="import-validation-error">
      <strong>❌ Found ${errors.length} issue${errors.length > 1 ? 's' : ''}:</strong>
      <ul>${errors.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>
    </div>`;
    return false;
  }

  // Count totals
  const totalQ = test.sections.reduce((s, sec) => s + (sec.questions || []).length, 0);
  resultEl.innerHTML = `<div class="import-validation-ok">
    ✅ Valid! <strong>${escHtml(test.title)}</strong> · ${test.type} · ${test.sections.length} sections · ${totalQ} questions
  </div>`;
  return true;
}

async function submitImportTest() {
  const raw = document.getElementById('import-json-input').value.trim();
  const errEl = document.getElementById('import-error');
  const sucEl = document.getElementById('import-success');
  const btn = document.getElementById('import-submit-btn');

  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!validateImportJson()) return; // shows its own error in validation result

  btn.disabled = true;
  btn.textContent = 'Importing…';
  try {
    const data = await api('/api/admin/tests/import', {
      method: 'POST',
      body: JSON.stringify({ json_text: raw }),
    });
    sucEl.textContent = `✅ ${data.message}`;
    sucEl.classList.remove('hidden');
    document.getElementById('import-json-input').value = '';
    document.getElementById('import-validation-result').classList.add('hidden');
    // Refresh materials list
    _materialsCache = await api('/api/admin/tests');
    renderMaterialsList();
  } catch (err) {
    errEl.textContent = '❌ ' + err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '⬆ Import Test';
  }
}

function downloadImportTemplate() {
  const isReading = currentMaterialsTab === 'reading';
  const sectionCount = isReading ? 3 : 4;
  const sectionTemplate = (num) => ({
    section_number: num,
    ...(isReading
      ? { passage_title: `Passage ${num} Title`, passage_text: 'Paste the full passage text here.' }
      : { audio_url: 'https://...', transcript: 'Optional transcript text.' }),
    questions: [
      { q_number: (num - 1) * 10 + 1, q_type: 'tfng', stem: 'Statement to evaluate.', correct_answer: 'TRUE' },
      { q_number: (num - 1) * 10 + 2, q_type: 'mcq', stem: 'According to the passage…', options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' }, correct_answer: 'A' },
      { q_number: (num - 1) * 10 + 3, q_type: 'fill', stem: 'The river flows through ___ before reaching the sea.', correct_answer: 'answer', accept_alternatives: ['alt1'] },
      { q_number: (num - 1) * 10 + 4, q_type: 'matching', stem: 'Match each item to a category.', options: { A: 'Category A', B: 'Category B' }, sub_questions: [{ label: 'Item 1', correct_answer: 'A' }, { label: 'Item 2', correct_answer: 'B' }] },
    ],
  });

  const template = {
    type: isReading ? 'reading' : 'listening',
    title: isReading ? 'Academic Reading Test 1' : 'Listening Test 1',
    sections: Array.from({ length: sectionCount }, (_, i) => sectionTemplate(i + 1)),
  };

  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.type}-test-template.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function collectSectionsData() {
  const count = currentMaterialsTab === 'reading' ? 3 : 4;
  const isReading = currentMaterialsTab === 'reading';
  const sections = [];

  for (let sn = 1; sn <= count; sn++) {
    const section = {
      section_number: sn,
      passage_title: isReading ? (document.getElementById(`sec${sn}_title`)?.value || '') : '',
      passage_text: isReading ? (document.getElementById(`sec${sn}_passage`)?.value || '') : '',
      audio_url: !isReading ? (document.getElementById(`sec${sn}_audio`)?.value || '') : '',
      transcript: !isReading ? (document.getElementById(`sec${sn}_transcript`)?.value || '') : '',
      questions: []
    };

    // Collect questions for this section
    const qContainer = document.getElementById(`questions_sec${sn}`);
    if (!qContainer) { sections.push(section); continue; }
    const qRows = qContainer.querySelectorAll('.question-builder-row');

    for (const row of qRows) {
      const rowId = row.id; // qbuilder_SN_QI
      const parts = rowId.split('_');
      const qi = parts[parts.length - 1];
      const sni = parts[parts.length - 2];
      const qnum = parseInt(document.getElementById(`qnum_${sni}_${qi}`)?.value || '0', 10);
      const qtype = document.getElementById(`qtype_${sni}_${qi}`)?.value || 'mcq';
      const stem = document.getElementById(`qstem_${sni}_${qi}`)?.value || '';

      const q = { q_number: qnum, q_type: qtype, stem };

      if (qtype === 'mcq') {
        q.options = {};
        for (const k of ['A','B','C','D']) {
          const v = document.getElementById(`qopt_${sni}_${qi}_${k}`)?.value || '';
          if (v) q.options[k] = v;
        }
        q.correct_answer = document.getElementById(`qcorrect_${sni}_${qi}`)?.value || 'A';
      } else if (qtype === 'tfng') {
        q.correct_answer = document.getElementById(`qcorrect_${sni}_${qi}`)?.value || 'TRUE';
      } else if (qtype === 'fill') {
        q.correct_answer = document.getElementById(`qcorrect_${sni}_${qi}`)?.value || '';
        const altsRaw = document.getElementById(`qalts_${sni}_${qi}`)?.value || '';
        q.accept_alternatives = altsRaw.split(',').map(s => s.trim()).filter(Boolean);
      } else if (qtype === 'matching') {
        const optsRaw = document.getElementById(`qopts_${sni}_${qi}`)?.value || '';
        q.options = {};
        for (const line of optsRaw.split('\n')) {
          const m = line.match(/^([A-Z])\.\s*(.+)/);
          if (m) q.options[m[1]] = m[2].trim();
        }
        const subsRaw = document.getElementById(`qsubs_${sni}_${qi}`)?.value || '';
        q.sub_questions = subsRaw.split('\n').filter(Boolean).map(line => {
          const [label, ans] = line.split('|').map(s => s.trim());
          return { label: label || '', correct_answer: ans || '' };
        });
      }
      if (qnum > 0) section.questions.push(q);
    }
    sections.push(section);
  }
  return sections;
}

async function submitCreateTest() {
  const errEl = document.getElementById('create-test-error');
  errEl.classList.add('hidden');
  const title = document.getElementById('new-test-title')?.value?.trim();
  if (!title) { errEl.textContent = 'Please enter a test title.'; errEl.classList.remove('hidden'); return; }
  const sections = collectSectionsData();
  const totalQ = sections.reduce((n, s) => n + s.questions.length, 0);
  if (totalQ === 0) { errEl.textContent = 'Please add at least one question.'; errEl.classList.remove('hidden'); return; }
  try {
    await api('/api/admin/tests', {
      method: 'POST',
      body: JSON.stringify({ type: currentMaterialsTab, title, sections })
    });
    // Refresh
    _materialsCache = await api('/api/admin/tests');
    renderMaterialsList();
    // Reset form
    document.getElementById('mat-panel-create').classList.add('hidden');
    document.getElementById('new-test-title').value = '';
    questionCounters = {};
    buildSectionsForm();
  } catch (err) {
    errEl.textContent = 'Failed to create test: ' + err.message;
    errEl.classList.remove('hidden');
  }
}

/* ─── Test Back / Discard / Partial Submit ────────────────────────────────── */
function handleTestBack() {
  const answeredCount = Object.values(currentAnswers).filter(v => v !== '' && v !== null && v !== undefined).length;
  const totalQuestions = currentTestData
    ? currentTestData.sections.reduce((sum, s) => sum + (s.questions ? s.questions.length : 0), 0)
    : 0;
  if (answeredCount > 0) {
    document.getElementById('discard-modal-overlay').classList.remove('hidden');
  } else {
    handleDiscardTest();
  }
}

function closeDiscardModal() {
  document.getElementById('discard-modal-overlay').classList.add('hidden');
}

function handleDiscardTest() {
  closeDiscardModal();
  if (testTimerInterval) {
    clearInterval(testTimerInterval);
    testTimerInterval = null;
  }
  currentTestData = null;
  currentAttemptId = null;
  currentAnswers = {};
  currentTestType = null;
  document.getElementById('app-screen').classList.remove('test-mode');
  showView('test-list');
}

function handlePartialSubmit() {
  closeDiscardModal();
  submitTest();
}

/* ─── Homework (Student View) ─────────────────────────────────────────────── */

async function loadHomework() {
  const el = document.getElementById('homework-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading homework…</div>';
  try {
    const assignments = await api('/api/assignments');
    if (!assignments.length) {
      el.innerHTML = '<div class="empty-state">No assignments yet. Your teacher will set homework here.</div>';
      return;
    }
    const now = new Date();
    const upcoming = assignments.filter(a => !a.completed && new Date(a.deadline) > now);
    const overdue = assignments.filter(a => !a.completed && new Date(a.deadline) <= now);
    const done = assignments.filter(a => a.completed);

    let html = '';
    if (overdue.length) {
      html += `<h3 class="hw-section-title hw-overdue-title">⚠️ Overdue (${overdue.length})</h3>`;
      html += overdue.map(a => renderHomeworkCard(a, 'overdue')).join('');
    }
    if (upcoming.length) {
      html += `<h3 class="hw-section-title">📅 Upcoming (${upcoming.length})</h3>`;
      html += upcoming.map(a => renderHomeworkCard(a, 'pending')).join('');
    }
    if (done.length) {
      html += `<h3 class="hw-section-title" style="margin-top:32px">✅ Completed (${done.length})</h3>`;
      html += done.map(a => renderHomeworkCard(a, 'done')).join('');
    }
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderHomeworkCard(a, status) {
  const typeLabels = {
    writing_task1: '✏️ Writing Task 1',
    writing_task2: '✏️ Writing Task 2',
    reading: '📖 Reading Test',
    listening: '🎧 Listening Test'
  };
  const typeLabel = typeLabels[a.type] || a.type;
  const deadline = new Date(a.deadline);
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeStr = '';
  if (status === 'done') {
    timeStr = `Completed ${formatDate(a.completed_at)}`;
  } else if (status === 'overdue') {
    timeStr = `Overdue — was due ${formatDate(a.deadline)}`;
  } else if (diffDays >= 1) {
    timeStr = `Due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${formatDate(a.deadline)})`;
  } else if (diffHours >= 1) {
    timeStr = `Due in ${diffHours} hour${diffHours > 1 ? 's' : ''} — ${formatDate(a.deadline)}`;
  } else {
    timeStr = `Due very soon — ${formatDate(a.deadline)}`;
  }

  // Color-coded countdown badge
  let countdownBadge = '';
  if (status === 'done') {
    countdownBadge = '<span class="hw-countdown hw-countdown-done">✓ Done</span>';
  } else if (status === 'overdue') {
    countdownBadge = '<span class="hw-countdown hw-countdown-overdue">⏰ Overdue</span>';
  } else if (diffDays >= 2) {
    countdownBadge = `<span class="hw-countdown hw-countdown-safe">⏳ ${diffDays}d left</span>`;
  } else if (diffDays >= 1) {
    countdownBadge = `<span class="hw-countdown hw-countdown-warn">⚠️ ${diffDays}d left</span>`;
  } else if (diffHours >= 1) {
    countdownBadge = `<span class="hw-countdown hw-countdown-urgent">🔴 ${diffHours}h left</span>`;
  } else {
    countdownBadge = '<span class="hw-countdown hw-countdown-urgent">🔴 Due very soon</span>';
  }

  const statusBadge = {
    pending: '<span class="hw-badge hw-badge-pending">Pending</span>',
    overdue: '<span class="hw-badge hw-badge-overdue">Overdue</span>',
    done: '<span class="hw-badge hw-badge-done">✓ Done</span>'
  }[status] || '';

  let actionBtn = '';
  if (status === 'done') {
    actionBtn = '<span class="text-muted" style="font-size:0.85rem">Completed</span>';
  } else if (a.type.startsWith('writing')) {
    const taskType = a.type === 'writing_task2' ? 'task2' : 'task1';
    actionBtn = `<button class="btn btn-primary btn-sm" onclick="startHomeworkWriting(${a.id}, '${taskType}')">Start Writing</button>`;
  } else if (a.test_id) {
    actionBtn = `<button class="btn btn-primary btn-sm" onclick="startHomeworkTest(${a.id}, ${a.test_id})">Start Test</button>`;
  } else {
    actionBtn = `<button class="btn btn-secondary btn-sm" onclick="markHomeworkDone(${a.id})">Mark as Done</button>`;
  }

  return `
    <div class="hw-card ${status === 'overdue' ? 'hw-card-overdue' : status === 'done' ? 'hw-card-done' : ''}">
      <div class="hw-card-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="hw-type-badge">${typeLabel}</span>
          ${statusBadge}
          ${countdownBadge}
        </div>
        <div class="hw-deadline">${timeStr}</div>
      </div>
      <h4 class="hw-card-title">${a.title}</h4>
      ${a.description ? `<p class="hw-card-desc">${a.description}</p>` : ''}
      ${a.custom_prompt ? `<p class="hw-card-prompt">"${escHtml(a.custom_prompt.slice(0, 120))}${a.custom_prompt.length > 120 ? '…' : ''}"</p>` : ''}
      ${a.test_title ? `<p class="hw-card-test">Linked test: <strong>${a.test_title}</strong></p>` : ''}
      <div class="hw-card-actions">${actionBtn}</div>
    </div>
  `;
}

async function startHomeworkWriting(assignmentId, taskType) {
  // Switch to writing view and pre-select task type, then mark done after submission
  showView('submit');

  // Select the correct task type radio
  const radios = document.querySelectorAll('input[name="task_type"]');
  radios.forEach(r => {
    r.checked = (r.value === taskType);
  });
  // Trigger UI update for task type
  if (typeof updateTaskInfo === 'function') updateTaskInfo();

  // Store assignment id to mark complete after submission
  window._pendingHomeworkAssignmentId = assignmentId;

  // Try to fetch assignment details to get custom_prompt
  try {
    const assignments = await api('/api/assignments');
    const a = (assignments || []).find(x => x.id === assignmentId);
    if (a && a.custom_prompt) {
      const promptEl = document.getElementById('essay-prompt');
      if (promptEl) {
        promptEl.value = a.custom_prompt;
        promptEl.readOnly = true;
        promptEl.style.background = 'var(--gray-100)';
        promptEl.dispatchEvent(new Event('input'));
      }
    } else {
      // Ensure prompt is editable when no custom prompt
      const promptEl = document.getElementById('essay-prompt');
      if (promptEl) { promptEl.readOnly = false; promptEl.style.background = ''; }
    }
    // Handle custom image URL for Task 1
    if (a && a.custom_image_url && taskType === 'task1') {
      const imgEl = document.getElementById('chart-topic-image');
      const frameEl = document.getElementById('chart-image-frame');
      if (imgEl) imgEl.src = a.custom_image_url;
      if (frameEl) frameEl.classList.remove('hidden');
    }
  } catch (err) {
    // Non-critical — just proceed without pre-fill
  }
}

function startHomeworkTest(assignmentId, testId) {
  window._pendingHomeworkAssignmentId = assignmentId;
  // Navigate to the specific test directly
  // startTest() lives in the test-taking section and handles the full flow
  showView('test-list');
  // After test list loads, trigger this specific test
  setTimeout(() => startTest(testId), 400);
}

async function markHomeworkDone(assignmentId) {
  if (!confirm('Mark this assignment as completed?')) return;
  try {
    await api(`/api/assignments/${assignmentId}/complete`, { method: 'POST' });
    loadHomework();
  } catch (err) {
    alert('Failed to mark as done: ' + err.message);
  }
}

/* ─── Grade Queue (Teacher/Admin Manual Grading) ─────────────────────────── */

function updateQueueBadge(count) {
  ['grade-queue-badge', 'grade-queue-badge-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

async function loadGradeQueue() {
  const listEl = document.getElementById('grade-queue-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading">Loading grade queue…</div>';
  try {
    const items = await api('/api/admin/submissions/pending');
    updateQueueBadge(items.length);
    if (!items.length) {
      listEl.innerHTML = '<div class="empty-state">🎉 No essays awaiting review. Queue is empty!</div>';
      return;
    }
    window._queueData = {};
    items.forEach(s => { window._queueData[s.id] = s; });
    listEl.innerHTML = items.map(s => renderQueueItem(s)).join('');
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Failed to load grade queue: ${escHtml(err.message)}</div>`;
  }
}

function renderQueueItem(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  const essayPreview = s.essay ? escHtml(s.essay.slice(0, 300)) + (s.essay.length > 300 ? '…' : '') : '';
  return `
    <div class="queue-item" id="queue-item-${s.id}">
      <div class="queue-item-header">
        <span class="submission-badge ${badgeClass}" style="width:auto;padding:3px 10px">${taskLabel}</span>
        <span class="queue-student">👤 ${escHtml(s.student_name)}${s.student_email ? `<span class="archive-student-email">&nbsp;·&nbsp;${escHtml(s.student_email)}</span>` : ''}</span>
        <span class="queue-meta">${s.word_count} words · ${formatDate(s.created_at)}</span>
      </div>
      <div class="queue-prompt"><strong>Prompt:</strong> ${escHtml(s.prompt)}</div>
      <div class="queue-essay-preview">${essayPreview}</div>
      <div class="queue-actions">
        <button class="btn btn-primary btn-sm" onclick="openGradingPanel(${s.id})">✏️ Grade Manually</button>
        <button class="btn btn-secondary btn-sm" onclick="gradeWithAI(${s.id}, this)">🤖 Send to AI</button>
        <button class="btn btn-outline btn-sm" onclick="toggleFullEssay(${s.id}, this)">📖 Full Essay</button>
      </div>
      <div class="full-essay hidden" id="full-essay-${s.id}">
        <div class="essay-text-block">${s.essay ? escHtml(s.essay) : ''}</div>
      </div>
      <div class="grading-panel hidden" id="grading-panel-${s.id}"></div>
    </div>`;
}

function toggleFullEssay(id, btn) {
  const el = document.getElementById(`full-essay-${id}`);
  if (!el) return;
  el.classList.toggle('hidden');
  btn.textContent = el.classList.contains('hidden') ? '📖 Full Essay' : '🙈 Hide Essay';
}

// ─── Submissions Archive ──────────────────────────────────────────────────────
let _archiveData = [];

async function loadSubmissionsArchive() {
  const listEl = document.getElementById('archive-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading">Loading submissions…</div>';
  try {
    _archiveData = await api('/api/admin/submissions/archive');
    filterArchive();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Failed to load archive: ${escHtml(err.message)}</div>`;
  }
}

function filterArchive() {
  const listEl = document.getElementById('archive-list');
  if (!listEl) return;
  const nameQ  = (document.getElementById('archive-filter-name')?.value || '').toLowerCase();
  const typeQ  = document.getElementById('archive-filter-type')?.value || '';
  const bandQ  = document.getElementById('archive-filter-band')?.value || '';

  let filtered = _archiveData;
  if (nameQ) filtered = filtered.filter(s => (s.student_name || '').toLowerCase().includes(nameQ) || (s.student_email || '').toLowerCase().includes(nameQ));
  if (typeQ) filtered = filtered.filter(s => s.task_type === typeQ);
  if (bandQ) {
    const bNum = parseFloat(bandQ);
    filtered = filtered.filter(s => {
      const b = parseFloat(s.band_score ?? s.overall_band);
      if (isNaN(b)) return false;
      return bandQ === '4' ? b <= 4 : b === bNum;
    });
  }

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state">No submissions match the filters.</div>';
    return;
  }
  listEl.innerHTML = filtered.map(s => renderArchiveItem(s)).join('');
}

function renderArchiveItem(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  const band = s.band_score ?? s.overall_band;
  const bandStr = band != null ? `Band ${band}` : 'No score';
  const gradedBy = s.graded_by === 'ai' ? '🤖 AI' : '👩‍🏫 Teacher';
  const preview = s.essay ? escHtml(s.essay.slice(0, 280)) + (s.essay.length > 280 ? '…' : '') : '';

  // Paste integrity badge
  let pasteBadge = '';
  const p = s.paste_stats;
  if (p && typeof p === 'object') {
    const totalInput = (p.total_pasted || 0) + (p.total_typed || 0);
    const pasteRatio = totalInput > 0 ? p.total_pasted / totalInput : 0;
    if (p.paste_count === 0) {
      pasteBadge = `<span class="paste-badge paste-clean" title="No pasting detected">✅ Typed</span>`;
    } else if (pasteRatio > 0.5) {
      pasteBadge = `<span class="paste-badge paste-suspicious" title="${p.paste_count} paste(s), largest ${p.largest_paste} chars, ~${Math.round(pasteRatio*100)}% pasted">🚨 Mostly pasted (${p.paste_count}×)</span>`;
    } else {
      pasteBadge = `<span class="paste-badge paste-mixed" title="${p.paste_count} paste(s), largest ${p.largest_paste} chars, ~${Math.round(pasteRatio*100)}% pasted">⚠️ Some pasting (${p.paste_count}×)</span>`;
    }
  }

  return `
    <div class="archive-item">
      <div class="archive-item-header">
        <span class="submission-badge ${badgeClass}" style="width:auto;padding:3px 10px">${taskLabel}</span>
        <span class="archive-band-badge">${bandStr}</span>
        <span class="archive-student">👤 ${escHtml(s.student_name)}${s.student_email ? `<span class="archive-student-email">&nbsp;·&nbsp;${escHtml(s.student_email)}</span>` : ''}</span>
        ${pasteBadge}
        <span class="archive-meta">${gradedBy} · ${s.word_count || '?'} words · ${formatDate(s.created_at)}</span>
      </div>
      <div class="archive-prompt"><strong>Prompt:</strong> ${escHtml(s.prompt || '')}</div>
      <div class="archive-essay-preview">${preview}</div>
      <div class="archive-actions">
        <button class="btn btn-outline btn-sm" onclick="toggleArchiveEssay(${s.id}, this)">📖 Full Essay</button>
        <button class="btn btn-outline btn-sm" onclick="viewArchiveFeedback(${s.id})">📊 Feedback</button>
      </div>
      <div class="archive-full-essay hidden" id="archive-essay-${s.id}">
        <div class="essay-text-block">${s.essay ? escHtml(s.essay) : ''}</div>
      </div>
    </div>`;
}

function toggleArchiveEssay(id, btn) {
  const el = document.getElementById(`archive-essay-${id}`);
  if (!el) return;
  el.classList.toggle('hidden');
  btn.textContent = el.classList.contains('hidden') ? '📖 Full Essay' : '🙈 Hide Essay';
}

function viewArchiveFeedback(id) {
  const s = _archiveData.find(x => x.id === id);
  if (!s) return;
  // Navigate to feedback view — renderFeedback writes directly to #feedback-content
  showView('feedback');
  // Patch back button to return to archive instead of student history
  const backBtn = document.querySelector('#view-feedback .btn-back');
  if (backBtn) {
    backBtn.onclick = () => showView('submissions-archive');
    backBtn.textContent = '← Archive';
  }
  const contentEl = document.getElementById('feedback-content');
  if (contentEl) contentEl.innerHTML = '<div class="loading">Loading…</div>';
  // renderFeedback is synchronous — writes to #feedback-content
  renderFeedback(s);
}
// ─────────────────────────────────────────────────────────────────────────────

function openGradingPanel(id) {
  const panel = document.getElementById(`grading-panel-${id}`);
  if (!panel) return;
  if (!panel.classList.contains('hidden') && panel.innerHTML) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }

  // Build band score options (0 to 9 in 0.5 steps)
  const bandOptions = [];
  for (let v = 9; v >= 0; v -= 0.5) {
    bandOptions.push(`<option value="${v}">${v}</option>`);
  }
  const bandSel = bandOptions.join('');

  // Get essay text for annotation
  const queueItem = window._queueData && window._queueData[id];
  const essayText = queueItem ? (queueItem.essay || '') : '';
  const existingAnnotations = (queueItem && queueItem.annotations) ? queueItem.annotations : [];

  const annotationSection = essayText ? `
    <div class="annotation-section">
      <div class="annotation-section-header">
        <span style="font-weight:600;font-size:.9rem">📝 Inline Annotations</span>
        <span style="font-size:.78rem;color:var(--gray-500)">Select text in essay to annotate</span>
      </div>
      <div class="annotation-legend">
        <span class="ann-type grammar">Grammar</span>
        <span class="ann-type vocabulary">Vocabulary</span>
        <span class="ann-type argument">Argument</span>
        <span class="ann-type structure">Structure</span>
        <span class="ann-type strength">Strength</span>
      </div>
      <div class="annotatable-essay" id="annotatable-essay-${id}"></div>
    </div>` : '';

  panel.innerHTML = `
    <div class="grading-form">
      <h4>✏️ Manual Grading</h4>
      ${annotationSection}
      <div class="band-input-grid">
        <div class="band-input-row">
          <label>Task Achievement / Response</label>
          <select id="gp-ta-${id}" onchange="updateGradingOverall(${id})">${bandSel}</select>
        </div>
        <div class="band-input-row">
          <label>Coherence &amp; Cohesion</label>
          <select id="gp-cc-${id}" onchange="updateGradingOverall(${id})">${bandSel}</select>
        </div>
        <div class="band-input-row">
          <label>Lexical Resource</label>
          <select id="gp-lr-${id}" onchange="updateGradingOverall(${id})">${bandSel}</select>
        </div>
        <div class="band-input-row">
          <label>Grammatical Range &amp; Accuracy</label>
          <select id="gp-gra-${id}" onchange="updateGradingOverall(${id})">${bandSel}</select>
        </div>
      </div>
      <div class="overall-band-preview">
        Overall Band: <span class="overall-band-display" id="gp-overall-${id}">—</span>
      </div>
      <div class="form-group">
        <label>Feedback / Comments</label>
        <textarea id="gp-feedback-${id}" rows="5" placeholder="Write your feedback for the student here…"></textarea>
      </div>
      <div class="form-group">
        <label>Strengths (one per line)</label>
        <textarea id="gp-strengths-${id}" rows="3" placeholder="Good use of linking words&#10;Clear argument structure&#10;…"></textarea>
      </div>
      <div class="form-group">
        <label>Improvements (one per line)</label>
        <textarea id="gp-improvements-${id}" rows="3" placeholder="Vary sentence structures more&#10;Avoid repetition&#10;…"></textarea>
      </div>
      <div class="queue-actions" style="margin-top:4px;margin-bottom:4px">
        <button class="btn btn-outline btn-sm" id="gp-ai-btn-${id}" onclick="getAISuggest(${id})">🤖 AI Suggest Scores</button>
      </div>
      <div id="gp-ai-rationale-${id}" class="grading-ai-rationale hidden"></div>
      <div id="gp-error-${id}" class="error-msg hidden"></div>
      <div class="queue-actions" style="margin-top:8px">
        <button class="btn btn-primary" onclick="submitManualGrade(${id})">✅ Submit Grade</button>
        <button class="btn btn-outline" onclick="closeGradingPanel(${id})">Cancel</button>
      </div>
    </div>`;
  panel.classList.remove('hidden');
  updateGradingOverall(id);

  // Initialize annotation panel if essay available
  if (essayText) {
    if (!window._annotations) window._annotations = {};
    window._annotations[id] = existingAnnotations.slice();
    initAnnotationPanel(id, essayText, window._annotations[id]);
  }
}

async function getAISuggest(id) {
  const btn = document.getElementById(`gp-ai-btn-${id}`);
  const rationaleEl = document.getElementById(`gp-ai-rationale-${id}`);
  if (!btn || !rationaleEl) return;
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';
  rationaleEl.classList.add('hidden');
  try {
    const result = await api(`/api/admin/submissions/${id}/ai-suggest`, { method: 'POST' });
    // Auto-fill the 4 band selects
    const setVal = (selId, val) => {
      const el = document.getElementById(selId);
      if (!el) return;
      // Find nearest available option
      const norm = Math.round(parseFloat(val) * 2) / 2;
      el.value = norm;
      if (!el.value) el.value = 6; // fallback
    };
    setVal(`gp-ta-${id}`,  result.task_achievement);
    setVal(`gp-cc-${id}`,  result.coherence_cohesion);
    setVal(`gp-lr-${id}`,  result.lexical_resource);
    setVal(`gp-gra-${id}`, result.grammatical_range);
    updateGradingOverall(id);
    if (result.rationale) {
      rationaleEl.textContent = '🤖 ' + result.rationale;
      rationaleEl.classList.remove('hidden');
    }
    btn.textContent = '🔄 Re-suggest';
  } catch (err) {
    rationaleEl.textContent = 'AI suggestion failed: ' + err.message;
    rationaleEl.classList.remove('hidden');
    btn.textContent = '🤖 AI Suggest Scores';
  }
  btn.disabled = false;
}

function closeGradingPanel(id) {
  const panel = document.getElementById(`grading-panel-${id}`);
  if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
}

function updateGradingOverall(id) {
  const ta  = parseFloat(document.getElementById(`gp-ta-${id}`)?.value  || 0);
  const cc  = parseFloat(document.getElementById(`gp-cc-${id}`)?.value  || 0);
  const lr  = parseFloat(document.getElementById(`gp-lr-${id}`)?.value  || 0);
  const gra = parseFloat(document.getElementById(`gp-gra-${id}`)?.value || 0);
  const overall = Math.round(((ta + cc + lr + gra) / 4) * 2) / 2;
  const el = document.getElementById(`gp-overall-${id}`);
  if (el) el.textContent = overall;
}

/* ─── Teacher Inline Essay Annotations ──────────────────────────────────── */

function initAnnotationPanel(subId, essayText, existingAnnotations) {
  const container = document.getElementById(`annotatable-essay-${subId}`);
  if (!container) return;
  renderAnnotatedEssay(container, essayText, existingAnnotations);
  container.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    // Compute offsets relative to plain-text essay
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selectedText = sel.toString();
    const end = start + selectedText.length;
    sel.removeAllRanges();
    showAnnotationPopup(subId, start, end, selectedText, e.clientX, e.clientY);
  });
}

function renderAnnotatedEssay(container, essayText, annotations, readOnly = false) {
  if (!annotations || !annotations.length) {
    container.textContent = essayText;
    return;
  }
  // Sort by start offset
  const sorted = [...annotations].sort((a, b) => a.start_offset - b.start_offset);
  let html = '';
  let pos = 0;
  for (const ann of sorted) {
    if (ann.start_offset > pos) {
      html += escHtml(essayText.slice(pos, ann.start_offset));
    }
    const safeComment = escHtml(ann.comment || '');
    html += `<mark class="ann-mark ann-${ann.type}" data-ann-id="${ann.id}" data-comment="${safeComment}" data-type="${ann.type}">${escHtml(essayText.slice(ann.start_offset, ann.end_offset))}</mark>`;
    pos = ann.end_offset;
  }
  if (pos < essayText.length) {
    html += escHtml(essayText.slice(pos));
  }
  container.innerHTML = html;

  // Attach tooltip events
  container.querySelectorAll('.ann-mark').forEach(mark => {
    if (!readOnly) {
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        const annId = mark.dataset.annId;
        showAnnotationDeleteMenu(mark, annId);
      });
    }
    mark.addEventListener('mouseenter', (e) => showAnnTooltip(e, mark));
    mark.addEventListener('mouseleave', hideAnnTooltip);
  });
}

function showAnnotationPopup(subId, start, end, selectedText, clientX, clientY) {
  // Remove existing popup
  document.querySelectorAll('.ann-popup').forEach(p => p.remove());

  const types = ['grammar', 'vocabulary', 'argument', 'structure', 'strength'];
  let selectedType = 'grammar';

  const popup = document.createElement('div');
  popup.className = 'ann-popup';
  popup.style.cssText = `left:${Math.min(clientX, window.innerWidth - 280)}px;top:${Math.min(clientY + 8, window.innerHeight - 200)}px`;
  popup.innerHTML = `
    <div style="font-size:.8rem;font-weight:600;margin-bottom:6px">Annotate: "<em>${escHtml(selectedText.slice(0, 40))}${selectedText.length > 40 ? '…' : ''}</em>"</div>
    <div class="ann-type-row" id="ann-type-row">
      ${types.map(t => `<button class="ann-type-btn ann-type-btn-${t}${t === selectedType ? ' selected' : ''}" onclick="selectAnnType(this,'${t}')">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('')}
    </div>
    <textarea id="ann-comment-input" class="form-input" rows="2" placeholder="Comment (optional)" style="margin-bottom:6px;font-size:.82rem"></textarea>
    <div style="display:flex;gap:6px">
      <button class="btn btn-primary btn-sm" onclick="saveAnnotation(${subId},${start},${end})">Save</button>
      <button class="btn btn-outline btn-sm" onclick="this.closest('.ann-popup').remove()">Cancel</button>
    </div>`;

  document.body.appendChild(popup);
  popup.querySelector('#ann-comment-input').focus();

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

window._annSelectedType = 'grammar';
function selectAnnType(btn, type) {
  window._annSelectedType = type;
  btn.closest('.ann-type-row').querySelectorAll('.ann-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function saveAnnotation(subId, start, end) {
  const popup = document.querySelector('.ann-popup');
  const comment = popup ? (popup.querySelector('#ann-comment-input')?.value.trim() || '') : '';
  const type = window._annSelectedType || 'grammar';
  if (popup) popup.remove();

  if (!window._annotations) window._annotations = {};
  if (!window._annotations[subId]) window._annotations[subId] = [];

  const ann = { id: Date.now().toString(), start_offset: start, end_offset: end, comment, type };
  window._annotations[subId].push(ann);

  const qd = window._queueData && window._queueData[subId];
  const essayText = qd ? (qd.essay || '') : '';
  const container = document.getElementById(`annotatable-essay-${subId}`);
  if (container && essayText) renderAnnotatedEssay(container, essayText, window._annotations[subId]);
}

function showAnnotationDeleteMenu(mark, annId) {
  document.querySelectorAll('.ann-delete-menu').forEach(m => m.remove());
  const rect = mark.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'ann-popup ann-delete-menu';
  menu.style.cssText = `left:${rect.left}px;top:${rect.bottom + 4}px;min-width:120px`;
  menu.innerHTML = `<button class="btn btn-danger btn-sm" style="width:100%" onclick="deleteAnnotation(this,'${annId}')">🗑 Remove annotation</button>`;
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

function deleteAnnotation(btn, annId) {
  btn.closest('.ann-delete-menu').remove();
  // Find subId from annotatable-essay container
  const container = document.querySelector('.annotatable-essay');
  if (!container) return;
  const subId = container.id.replace('annotatable-essay-', '');
  if (!window._annotations || !window._annotations[subId]) return;
  window._annotations[subId] = window._annotations[subId].filter(a => a.id !== annId);
  const qd = window._queueData && window._queueData[subId];
  const essayText = qd ? (qd.essay || '') : '';
  if (essayText) renderAnnotatedEssay(container, essayText, window._annotations[subId]);
}

let _annTooltipEl = null;
function showAnnTooltip(e, mark) {
  hideAnnTooltip();
  const comment = mark.dataset.comment;
  const type = mark.dataset.type;
  if (!comment && !type) return;
  const tip = document.createElement('div');
  tip.className = 'ann-tooltip';
  tip.innerHTML = `<strong>${type ? type.charAt(0).toUpperCase()+type.slice(1) : ''}</strong>${comment ? ': ' + escHtml(comment) : ''}`;
  tip.style.cssText = `left:${e.clientX + 12}px;top:${e.clientY - 8}px`;
  document.body.appendChild(tip);
  _annTooltipEl = tip;
}
function hideAnnTooltip() {
  if (_annTooltipEl) { _annTooltipEl.remove(); _annTooltipEl = null; }
}

async function submitManualGrade(id) {
  const errEl = document.getElementById(`gp-error-${id}`);
  errEl.classList.add('hidden');

  const ta  = parseFloat(document.getElementById(`gp-ta-${id}`)?.value);
  const cc  = parseFloat(document.getElementById(`gp-cc-${id}`)?.value);
  const lr  = parseFloat(document.getElementById(`gp-lr-${id}`)?.value);
  const gra = parseFloat(document.getElementById(`gp-gra-${id}`)?.value);
  const feedback = document.getElementById(`gp-feedback-${id}`)?.value.trim() || '';
  const strengthsRaw = document.getElementById(`gp-strengths-${id}`)?.value || '';
  const improvementsRaw = document.getElementById(`gp-improvements-${id}`)?.value || '';

  if ([ta, cc, lr, gra].some(isNaN)) {
    errEl.textContent = 'Please fill in all four band scores.';
    errEl.classList.remove('hidden');
    return;
  }

  const strengths = strengthsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  const improvements = improvementsRaw.split('\n').map(s => s.trim()).filter(Boolean);

  const annotations = (window._annotations && window._annotations[id]) || [];

  try {
    await api(`/api/admin/submissions/${id}/grade`, {
      method: 'POST',
      body: JSON.stringify({ task_achievement: ta, coherence_cohesion: cc, lexical_resource: lr, grammatical_range: gra, detailed_feedback: feedback, strengths, improvements, annotations })
    });
    // Remove from queue
    const item = document.getElementById(`queue-item-${id}`);
    if (item) item.remove();
    // Update badge
    const remaining = document.querySelectorAll('.queue-item').length;
    updateQueueBadge(remaining);
    if (!remaining) {
      const listEl = document.getElementById('grade-queue-list');
      if (listEl) listEl.innerHTML = '<div class="empty-state">🎉 No essays awaiting review. Queue is empty!</div>';
    }
  } catch (err) {
    errEl.textContent = 'Failed to submit grade: ' + err.message;
    errEl.classList.remove('hidden');
  }
}

async function gradeWithAI(id, btn) {
  if (!confirm('This will use AI credits (~$0.01) to grade this essay. Continue?')) return;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending to AI…';
  try {
    await api(`/api/admin/submissions/${id}/grade-ai`, { method: 'POST' });
    // Remove from pending queue (AI will handle it)
    const item = document.getElementById(`queue-item-${id}`);
    if (item) item.remove();
    const remaining = document.querySelectorAll('.queue-item').length;
    updateQueueBadge(remaining);
    if (!remaining) {
      const listEl = document.getElementById('grade-queue-list');
      if (listEl) listEl.innerHTML = '<div class="empty-state">🎉 No essays awaiting review. Queue is empty!</div>';
    }
  } catch (err) {
    alert('Failed to start AI grading: ' + err.message);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

/* ─── Admin Assignments ───────────────────────────────────────────────────── */

async function loadAdminAssignments() {
  const el = document.getElementById('admin-assignments-list');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading…</div>';

  // Also populate the test selector and student list in the create form
  try {
    const [assignments, readingTests, listeningTests, usersData] = await Promise.all([
      api('/api/admin/assignments'),
      api('/api/admin/tests?type=reading').catch(() => []),
      api('/api/admin/tests?type=listening').catch(() => []),
      api('/api/admin/users').catch(() => ({ users: [] }))
    ]);

    const allTests = [...readingTests, ...listeningTests];
    const testSel = document.getElementById('assign-test-id');
    if (testSel) {
      testSel.innerHTML = '<option value="">— Select a test —</option>' +
        allTests.map(t => `<option value="${t.id}">[${t.type}] ${t.title}</option>`).join('');
    }

    // Populate student multi-select
    // /api/admin/users returns a plain array, not { users: [...] }
    const studentListEl = document.getElementById('assign-students-list');
    if (studentListEl) {
      const allUsers = Array.isArray(usersData) ? usersData : (usersData.users || []);
      const students = allUsers.filter(u => u.role === 'student');
      if (students.length) {
        studentListEl.innerHTML = students.map(u => `
          <label class="assign-student-row">
            <input type="checkbox" class="assign-student-cb" value="${u.id}">
            <span>${escHtml(u.name)}</span>
            <span class="form-hint" style="margin-left:auto">${escHtml(u.email)}</span>
          </label>
        `).join('');
      } else {
        studentListEl.innerHTML = '<div class="form-hint">No students enrolled yet.</div>';
      }
    }

    // Show/hide custom prompt field based on currently-selected type (must run even when list is empty)
    updateAssignTestField();

    if (!assignments.length) {
      el.innerHTML = '<div class="empty-state">No assignments yet. Create one above.</div>';
      return;
    }

    el.innerHTML = `
      <div id="assign-batch-toolbar" class="assign-batch-toolbar hidden">
        <span id="assign-batch-count">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="deleteSelectedAssignments()">🗑 Delete Selected</button>
        <button class="btn btn-outline btn-sm" onclick="clearAssignSelection()">✕ Clear</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width:36px"><input type="checkbox" id="assign-select-all" onchange="toggleAssignSelectAll(this)" title="Select all"></th>
              <th>Title</th>
              <th>Type</th>
              <th>Assigned To</th>
              <th>Deadline</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${assignments.map(a => {
              const now = new Date();
              const dl = new Date(a.deadline);
              const overdue = dl < now;
              let assignedLabel;
              if (!a.assigned_to || a.assigned_to.length === 0) {
                assignedLabel = '<span class="badge badge-gray">All students</span>';
              } else if (a.assigned_to_details && a.assigned_to_details.length) {
                assignedLabel = a.assigned_to_details.map(d => `<span class="badge badge-blue" style="margin-right:2px">${escHtml(d.name)}</span>`).join('');
              } else {
                assignedLabel = `<span class="badge badge-blue">${a.assigned_to.length} student${a.assigned_to.length !== 1 ? 's' : ''}</span>`;
              }
              return `
                <tr>
                  <td><input type="checkbox" class="assign-row-cb" value="${a.id}" onchange="updateBatchToolbar()"></td>
                  <td><strong>${a.title}</strong>${a.description ? `<br><small class="text-muted">${a.description.slice(0,60)}${a.description.length>60?'…':''}</small>` : ''}</td>
                  <td><span class="badge badge-gray">${a.type.replace('_', ' ')}</span></td>
                  <td>${assignedLabel}</td>
                  <td class="${overdue ? 'text-danger' : ''}">${formatDate(a.deadline)}</td>
                  <td>${(() => {
                    const comps = a.completed_by || [];
                    if (!comps.length) return '<span class="badge badge-gray">0 submitted</span>';
                    return comps.map(c => {
                      const badge = c.is_late
                        ? `<span class="badge badge-late" title="Submitted ${formatDate(c.completed_at)}">⚠️ ${escHtml(c.name)} — Late</span>`
                        : `<span class="badge badge-ontime" title="Submitted ${formatDate(c.completed_at)}">✅ ${escHtml(c.name)}</span>`;
                      return badge;
                    }).join(' ');
                  })()}</td>
                  <td><button class="btn btn-danger btn-xs" onclick="confirmDeleteAssignment(${a.id}, '${a.title.replace(/'/g, "\\'")}')">Delete</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

// ── Assignment image upload helpers ──────────────────────────────────────────
let assignImageDataUrl = null;

function switchAssignImgTab(tab) {
  const urlDiv    = document.getElementById('assign-img-tab-url');
  const uploadDiv = document.getElementById('assign-img-tab-upload');
  document.querySelectorAll('.assign-img-tab').forEach(t => t.classList.remove('active'));
  const activeBtn = document.querySelector(`.assign-img-tab[onclick="switchAssignImgTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
  if (urlDiv)    urlDiv.style.display    = (tab === 'url')    ? '' : 'none';
  if (uploadDiv) uploadDiv.style.display = (tab === 'upload') ? '' : 'none';
}

function handleAssignImageFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    assignImageDataUrl = e.target.result;
    const preview = document.getElementById('assign-img-preview');
    const label   = document.getElementById('assign-img-upload-text');
    if (preview) { preview.src = assignImageDataUrl; preview.style.display = 'block'; }
    if (label)   label.textContent = '✅ ' + file.name;
  };
  reader.readAsDataURL(file);
}

function updateAssignTestField() {
  const type = document.getElementById('assign-type').value;
  const group = document.getElementById('assign-test-group');
  if (group) group.style.display = (type === 'reading' || type === 'listening') ? 'block' : 'none';

  // Show custom prompt group for writing assignments
  const promptGroup = document.getElementById('assign-custom-prompt-group');
  const imageUrlGroup = document.getElementById('assign-image-url-group');
  if (promptGroup) {
    const isWriting = type === 'writing_task1' || type === 'writing_task2';
    promptGroup.style.display = isWriting ? 'block' : 'none';
    if (imageUrlGroup) imageUrlGroup.style.display = (type === 'writing_task1') ? 'block' : 'none';
  }
}

async function createAssignment() {
  const errEl = document.getElementById('assign-error');
  const okEl = document.getElementById('assign-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  const title = document.getElementById('assign-title').value.trim();
  const type = document.getElementById('assign-type').value;
  const deadline = document.getElementById('assign-deadline').value;
  const description = document.getElementById('assign-description').value.trim();
  const testIdEl = document.getElementById('assign-test-id');
  const test_id = testIdEl && testIdEl.value ? parseInt(testIdEl.value, 10) : null;
  const custom_prompt = document.getElementById('assign-custom-prompt')?.value.trim() || null;
  // Image: uploaded file takes priority over pasted URL
  const custom_image_url = assignImageDataUrl
    || document.getElementById('assign-custom-image-url')?.value.trim()
    || null;

  // Collect target students (empty array = all students)
  const allStudentsChecked = document.getElementById('assign-all-students')?.checked !== false;
  const assigned_to = allStudentsChecked
    ? []
    : [...document.querySelectorAll('.assign-student-cb:checked')].map(cb => parseInt(cb.value, 10));

  if (!title) { errEl.textContent = 'Title is required'; errEl.classList.remove('hidden'); return; }
  if (!deadline) { errEl.textContent = 'Deadline is required'; errEl.classList.remove('hidden'); return; }
  if (!allStudentsChecked && assigned_to.length === 0) {
    errEl.textContent = 'Please select at least one student, or check "All students"';
    errEl.classList.remove('hidden'); return;
  }

  const deadlineISO = new Date(deadline).toISOString();

  try {
    await api('/api/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({ title, type, description, test_id, deadline: deadlineISO, assigned_to,
        custom_prompt: custom_prompt || null,
        custom_image_url: (type === 'writing_task1' && custom_image_url) ? custom_image_url : null })
    });
    okEl.textContent = 'Assignment created!';
    okEl.classList.remove('hidden');
    // Clear form
    document.getElementById('assign-title').value = '';
    document.getElementById('assign-description').value = '';
    document.getElementById('assign-deadline').value = '';
    const cpEl = document.getElementById('assign-custom-prompt');
    const ciuEl = document.getElementById('assign-custom-image-url');
    if (cpEl) cpEl.value = '';
    if (ciuEl) ciuEl.value = '';
    // Reset image upload
    assignImageDataUrl = null;
    const fileInput = document.getElementById('assign-image-file');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('assign-img-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    const label = document.getElementById('assign-img-upload-text');
    if (label) label.textContent = 'Click to choose an image file';
    switchAssignImgTab('url');
    // Reset student selector to "All students"
    const allCb = document.getElementById('assign-all-students');
    if (allCb) { allCb.checked = true; toggleStudentSelect(); }
    document.querySelectorAll('.assign-student-cb').forEach(cb => cb.checked = false);
    // Reload list
    loadAdminAssignments();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function confirmDeleteAssignment(id, title) {
  if (!confirm(`Delete assignment "${title}"?\n\nThis will remove all student completion records too.`)) return;
  try {
    await api(`/api/admin/assignments/${id}`, { method: 'DELETE' });
    loadAdminAssignments();
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

/* ─── Batch Assignment Actions ────────────────────────────────────────────── */

function updateBatchToolbar() {
  const cbs = document.querySelectorAll('.assign-row-cb:checked');
  const toolbar = document.getElementById('assign-batch-toolbar');
  const countEl = document.getElementById('assign-batch-count');
  const selectAll = document.getElementById('assign-select-all');
  const all = document.querySelectorAll('.assign-row-cb');
  if (toolbar) toolbar.classList.toggle('hidden', cbs.length === 0);
  if (countEl) countEl.textContent = `${cbs.length} selected`;
  if (selectAll) selectAll.indeterminate = cbs.length > 0 && cbs.length < all.length;
  if (selectAll && cbs.length === all.length && all.length > 0) selectAll.checked = true;
}

function toggleAssignSelectAll(masterCb) {
  document.querySelectorAll('.assign-row-cb').forEach(cb => { cb.checked = masterCb.checked; });
  updateBatchToolbar();
}

function clearAssignSelection() {
  document.querySelectorAll('.assign-row-cb').forEach(cb => { cb.checked = false; });
  const masterCb = document.getElementById('assign-select-all');
  if (masterCb) { masterCb.checked = false; masterCb.indeterminate = false; }
  updateBatchToolbar();
}

async function deleteSelectedAssignments() {
  const checked = [...document.querySelectorAll('.assign-row-cb:checked')];
  if (!checked.length) return;
  const n = checked.length;

  if (!confirm(`Delete ${n} assignment${n > 1 ? 's' : ''}?\n\nThis removes all student completion records too. Cannot be undone.`)) return;

  const ids = checked.map(cb => parseInt(cb.value, 10));
  let failed = 0;
  for (const id of ids) {
    try { await api(`/api/admin/assignments/${id}`, { method: 'DELETE' }); }
    catch { failed++; }
  }
  if (failed) alert(`${failed} deletion${failed > 1 ? 's' : ''} failed.`);
  loadAdminAssignments();
}

/* ─── Assign Students Toggle ──────────────────────────────────────────────── */

function toggleStudentSelect() {
  const allChecked = document.getElementById('assign-all-students').checked;
  const listEl = document.getElementById('assign-students-list');
  if (listEl) listEl.classList.toggle('hidden', allChecked);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR TOGGLE
   ═══════════════════════════════════════════════════════════════════════════ */

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('.main-content');
  const showBtn = document.getElementById('sidebar-show-btn');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
  main.classList.toggle('sidebar-collapsed', isCollapsed);
  showBtn.classList.toggle('hidden', !isCollapsed);
  if (toggleBtn) toggleBtn.textContent = isCollapsed ? '›' : '‹';
  localStorage.setItem('ielts_sidebar_collapsed', isCollapsed ? '1' : '0');
}

/* ═══════════════════════════════════════════════════════════════════════════
   DARK MODE TOGGLE
   ═══════════════════════════════════════════════════════════════════════════ */
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('ielts_dark_mode', '0');
    document.getElementById('dark-mode-btn').textContent = '🌙';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ielts_dark_mode', '1');
    document.getElementById('dark-mode-btn').textContent = '☀️';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESSAY DRAFT AUTO-SAVE
   ═══════════════════════════════════════════════════════════════════════════ */
let _draftSaveTimer = null;
let _currentDraftId = null; // server-side draft currently loaded

function saveDraft() {
  const prompt = (document.getElementById('essay-prompt') || {}).value || '';
  const essay = (document.getElementById('essay-text') || {}).value || '';
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  if (!prompt && !essay) return; // nothing to save
  const draft = { prompt, essay, taskType, savedAt: Date.now() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function showToast(msg, duration) {
  duration = duration || 2500;
  const el = document.getElementById('draft-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function manualSaveDraft() {
  const prompt = (document.getElementById('essay-prompt') || {}).value || '';
  const essay  = (document.getElementById('essay-text')   || {}).value || '';
  if (!prompt && !essay) { showToast('Nothing to save yet.'); return; }
  saveDraft(); // always keep localStorage copy
  if (currentUser) {
    saveServerDraft();
  } else {
    showToast('✅ Draft saved');
  }
}

async function saveServerDraft() {
  const prompt   = (document.getElementById('essay-prompt') || {}).value || '';
  const essay    = (document.getElementById('essay-text')   || {}).value || '';
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const wordCount = parseInt((document.getElementById('word-count-badge') || {}).textContent) || 0;
  // Build a title from first ~50 chars of prompt, or fallback
  const rawTitle = prompt.slice(0, 50).trim() || essay.slice(0, 50).trim() || 'Untitled draft';
  const title = rawTitle.length < prompt.slice(0, 50).trim().length ? rawTitle + '…' : rawTitle;
  const body = { title, prompt, essay, taskType, wordCount };
  try {
    let res;
    if (_currentDraftId) {
      res = await fetch(`/api/drafts/${_currentDraftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify(body)
      });
    } else {
      res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify(body)
      });
    }
    if (res.ok) {
      const draft = await res.json();
      _currentDraftId = draft.id;
      showToast('✅ Draft saved to server');
    } else {
      showToast('✅ Draft saved locally');
    }
  } catch {
    showToast('✅ Draft saved locally');
  }
}

function onDraftInput() {
  clearTimeout(_draftSaveTimer);
  _draftSaveTimer = setTimeout(saveDraft, 1200); // debounce 1.2s
}

function loadDraftIfExists() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (!draft.prompt && !draft.essay) return;
    const ageMin = Math.round((Date.now() - (draft.savedAt || 0)) / 60000);
    const banner = document.getElementById('draft-restore-banner');
    if (!banner) return;
    banner.innerHTML = `
      📝 You have an unsaved draft from ${ageMin < 1 ? 'just now' : ageMin + ' min ago'}.
      <button class="btn btn-primary btn-sm" onclick="restoreDraft()">Restore Draft</button>
      <button class="btn btn-secondary btn-sm" onclick="discardDraft()">Discard</button>`;
    banner.classList.remove('hidden');
  } catch {}
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    // Set task type
    const radios = document.querySelectorAll('input[name="task_type"]');
    radios.forEach(r => { r.checked = r.value === draft.taskType; });
    if (draft.taskType) {
      const changeEvt = new Event('change');
      document.querySelector(`input[name="task_type"][value="${draft.taskType}"]`)?.dispatchEvent(changeEvt);
    }
    // Restore text
    const promptEl = document.getElementById('essay-prompt');
    const essayEl = document.getElementById('essay-text');
    if (promptEl) promptEl.value = draft.prompt || '';
    if (essayEl) { essayEl.value = draft.essay || ''; updateWordCount(); }
    const banner = document.getElementById('draft-restore-banner');
    if (banner) banner.classList.add('hidden');
  } catch {}
}

function discardDraft() {
  localStorage.removeItem(DRAFT_KEY);
  const banner = document.getElementById('draft-restore-banner');
  if (banner) banner.classList.add('hidden');
}

/* ── My Drafts Modal ──────────────────────────────────────────────────── */
async function openDraftsModal() {
  const modal = document.getElementById('drafts-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('drafts-modal-list').innerHTML = '<p style="color:var(--text-secondary)">Loading…</p>';
  await loadServerDrafts();
}

function closeDraftsModal() {
  const modal = document.getElementById('drafts-modal');
  if (modal) modal.classList.add('hidden');
}

async function loadServerDrafts() {
  const list = document.getElementById('drafts-modal-list');
  if (!list) return;
  if (!currentUser) {
    list.innerHTML = '<p style="color:var(--text-secondary)">Sign in to view saved drafts.</p>';
    return;
  }
  try {
    const res = await fetch('/api/drafts', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    if (!res.ok) { list.innerHTML = '<p style="color:var(--danger)">Failed to load drafts.</p>'; return; }
    const drafts = await res.json();
    if (!drafts.length) {
      list.innerHTML = '<p style="color:var(--text-secondary)">No saved drafts yet. Use "Save Draft" while writing to save your work here.</p>';
      return;
    }
    list.innerHTML = drafts.map(d => {
      const dt = new Date(d.updated_at);
      const dateStr = dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) +
                      ' ' + dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
      const badge = d.task_type === 'task1' ? '<span class="badge badge-t1">Task 1</span>' : '<span class="badge badge-t2">Task 2</span>';
      const words = d.word_count ? `<span style="color:var(--text-secondary);font-size:12px">${d.word_count} words</span>` : '';
      const preview = d.essay ? d.essay.slice(0, 100).replace(/</g,'&lt;') + (d.essay.length > 100 ? '…' : '') : '<em style="color:var(--text-secondary)">No essay text yet</em>';
      return `<div class="draft-item" id="draft-item-${d.id}">
        <div class="draft-item-header">
          <span class="draft-item-title">${d.title || 'Untitled'}</span>
          ${badge} ${words}
        </div>
        <div class="draft-item-preview">${preview}</div>
        <div class="draft-item-footer">
          <span style="color:var(--text-secondary);font-size:12px">Saved ${dateStr}</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary btn-sm" onclick="loadDraftFromServer(${d.id})">📂 Load</button>
            <button class="btn btn-danger btn-sm" onclick="deleteServerDraft(${d.id})">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--danger)">Error loading drafts.</p>';
  }
}

function loadDraftFromServer(id) {
  if (!currentUser) return;
  fetch('/api/drafts', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  }).then(r => r.json()).then(drafts => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) { showToast('Draft not found.'); return; }
    // Switch task type
    const radios = document.querySelectorAll('input[name="task_type"]');
    radios.forEach(r => { r.checked = r.value === draft.task_type; });
    document.querySelector(`input[name="task_type"][value="${draft.task_type}"]`)?.dispatchEvent(new Event('change'));
    // Restore text
    const promptEl = document.getElementById('essay-prompt');
    const essayEl  = document.getElementById('essay-text');
    if (promptEl) promptEl.value = draft.prompt || '';
    if (essayEl)  { essayEl.value = draft.essay || ''; updateWordCount(); }
    _currentDraftId = draft.id;
    closeDraftsModal();
    showView('submit');
    showToast(`📂 Draft "${draft.title || 'Untitled'}" loaded`);
  }).catch(() => showToast('Failed to load draft.'));
}

async function deleteServerDraft(id) {
  if (!currentUser) return;
  if (!confirm('Delete this draft? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/drafts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    if (res.ok) {
      if (_currentDraftId === id) _currentDraftId = null;
      document.getElementById(`draft-item-${id}`)?.remove();
      const list = document.getElementById('drafts-modal-list');
      if (list && !list.querySelector('.draft-item')) {
        list.innerHTML = '<p style="color:var(--text-secondary)">No saved drafts yet.</p>';
      }
      showToast('🗑 Draft deleted');
    } else {
      showToast('Failed to delete draft.');
    }
  } catch {
    showToast('Failed to delete draft.');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   WRITING TIMER
   ═══════════════════════════════════════════════════════════════════════════ */
function setWritingTimer(minutes) {
  writingTimerSecs = minutes * 60;
  writingTimerRunning = true;
  clearInterval(writingTimerInterval);
  // Show controls
  document.getElementById('writing-timer-controls').classList.remove('hidden');
  document.getElementById('writing-timer-toggle').textContent = '⏸ Pause';
  updateWritingTimerDisplay();
  writingTimerInterval = setInterval(() => {
    if (!writingTimerRunning) return;
    writingTimerSecs--;
    updateWritingTimerDisplay();
    if (writingTimerSecs <= 0) {
      clearInterval(writingTimerInterval);
      writingTimerRunning = false;
      const displayEl = document.getElementById('writing-timer-display');
      if (displayEl) {
        displayEl.textContent = '00:00';
        displayEl.classList.add('timer-warning');
      }
      alert('⏱ Time is up! Please submit your essay.');
    }
  }, 1000);
}

function updateWritingTimerDisplay() {
  const displayEl = document.getElementById('writing-timer-display');
  if (!displayEl) return;
  const m = Math.floor(writingTimerSecs / 60).toString().padStart(2, '0');
  const s = (writingTimerSecs % 60).toString().padStart(2, '0');
  displayEl.textContent = `${m}:${s}`;
  if (writingTimerSecs <= 300) {
    displayEl.classList.add('timer-warning');
  } else {
    displayEl.classList.remove('timer-warning');
  }
}

function toggleWritingTimer() {
  writingTimerRunning = !writingTimerRunning;
  const toggleBtn = document.getElementById('writing-timer-toggle');
  if (toggleBtn) toggleBtn.textContent = writingTimerRunning ? '⏸ Pause' : '▶ Resume';
}

function resetWritingTimer() {
  clearInterval(writingTimerInterval);
  writingTimerRunning = false;
  writingTimerSecs = 0;
  document.getElementById('writing-timer-controls').classList.add('hidden');
  const displayEl = document.getElementById('writing-timer-display');
  if (displayEl) { displayEl.textContent = '40:00'; displayEl.classList.remove('timer-warning'); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RETRY GRADING
   ═══════════════════════════════════════════════════════════════════════════ */
async function retryGrading(submissionId) {
  try {
    await api(`/api/submissions/${submissionId}/retry`, { method: 'POST' });
    // Show feedback view (will poll)
    viewFeedback(submissionId);
  } catch (err) {
    alert('Retry failed: ' + err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOCABULARY FLASHCARDS
   ═══════════════════════════════════════════════════════════════════════════ */
async function openFlashcards(submissionId) {
  // Show modal
  document.getElementById('flashcard-modal-overlay').classList.remove('hidden');
  document.getElementById('flashcard-loading').classList.remove('hidden');
  document.getElementById('flashcard-container').classList.add('hidden');
  document.getElementById('flashcard-error').classList.add('hidden');
  flashcards = [];
  flashcardIndex = 0;

  try {
    const data = await api(`/api/submissions/${submissionId}/flashcards`, { method: 'POST' });
    flashcards = data.cards || [];
    if (flashcards.length === 0) throw new Error('No flashcards generated');
    document.getElementById('flashcard-loading').classList.add('hidden');
    document.getElementById('flashcard-container').classList.remove('hidden');
    renderFlashcard();
  } catch (err) {
    document.getElementById('flashcard-loading').classList.add('hidden');
    const errEl = document.getElementById('flashcard-error');
    errEl.textContent = 'Could not generate flashcards: ' + err.message;
    errEl.classList.remove('hidden');
  }
}

function renderFlashcard() {
  if (!flashcards.length) return;
  const card = flashcards[flashcardIndex];
  document.getElementById('flashcard-word').textContent = card.word || '';
  document.getElementById('flashcard-definition').textContent = card.definition || '';
  document.getElementById('flashcard-example').textContent = card.example || '';
  document.getElementById('flashcard-counter').textContent = `${flashcardIndex + 1} / ${flashcards.length}`;
  // Type badge
  const badgeEl = document.getElementById('flashcard-type-badge');
  if (badgeEl) {
    const typeMap = {
      vocabulary: { label: 'Vocabulary', cls: 'ftb-vocabulary' },
      phrase:     { label: 'Phrase',     cls: 'ftb-phrase' },
      collocation:{ label: 'Collocation',cls: 'ftb-collocation' },
    };
    const t = typeMap[card.type] || typeMap['vocabulary'];
    badgeEl.innerHTML = `<span class="flashcard-type-badge ${t.cls}">${t.label}</span>`;
  }
  // Reset flip state
  const cardEl = document.getElementById('flashcard-card');
  if (cardEl) cardEl.classList.remove('flipped');
}

function animateCard(dir) {
  const scene = document.querySelector('.flashcard-scene');
  if (!scene) { renderFlashcard(); return; }
  const cls = dir === 'right' ? 'slide-right' : 'slide-left';
  scene.classList.remove('slide-right', 'slide-left');
  // Force reflow to restart animation
  void scene.offsetWidth;
  scene.classList.add(cls);
  renderFlashcard();
}

function flipCard() {
  const cardEl = document.getElementById('flashcard-card');
  if (cardEl) cardEl.classList.toggle('flipped');
}

function nextCard() {
  if (flashcardIndex < flashcards.length - 1) {
    flashcardIndex++;
    animateCard('right');
  }
}

function prevCard() {
  if (flashcardIndex > 0) {
    flashcardIndex--;
    animateCard('left');
  }
}

function markCard(result) {
  // 'got' moves forward, 'hard' stays or moves to end
  if (result === 'got') {
    nextCard();
  } else {
    // Move card to end for review
    const card = flashcards.splice(flashcardIndex, 1)[0];
    flashcards.push(card);
    if (flashcardIndex >= flashcards.length) flashcardIndex = 0;
    renderFlashcard();
  }
}

function closeFlashcardModal(event) {
  if (event && event.target !== document.getElementById('flashcard-modal-overlay')) return;
  document.getElementById('flashcard-modal-overlay').classList.add('hidden');
}

/* ─── Attendance / Classes ───────────────────────────────────────────────── */

async function loadClassList() {
  const container = document.getElementById('classes-list-container');
  const controls = document.getElementById('classes-teacher-controls');
  container.innerHTML = '<div class="loading">Loading classes…</div>';

  // Create Class form (teacher/admin only)
  if (currentUser.role === 'teacher' || currentUser.role === 'admin') {
    controls.innerHTML = `
      <div class="card mb-4" id="create-class-card">
        <h3 style="margin-bottom:12px;font-size:1rem;font-weight:600">Create New Class</h3>
        <div class="form-group">
          <label>Class Name</label>
          <input type="text" id="new-class-name" class="form-input" placeholder="e.g. IELTS Band 6 Morning Group">
        </div>
        <div class="form-group">
          <label>Description <small class="text-muted">(optional)</small></label>
          <input type="text" id="new-class-desc" class="form-input" placeholder="Short description">
        </div>
        <div id="create-class-error" class="error-msg hidden"></div>
        <button class="btn btn-primary" onclick="createClass()">+ Create Class</button>
      </div>`;
  } else {
    controls.innerHTML = '';
  }

  try {
    const classes = await api('/api/classes');
    if (!classes.length) {
      container.innerHTML = '<div class="empty-state">No classes yet.</div>';
      return;
    }
    container.innerHTML = classes.map(c => `
      <div class="class-card">
        <div class="class-card-info">
          <div class="class-card-name">${c.name}</div>
          ${c.description ? `<div class="class-card-desc">${c.description}</div>` : ''}
          <div class="class-card-meta">Teacher: ${c.teacher_name || 'Unknown'} · ${c.student_count || 0} students</div>
        </div>
        <div class="class-card-actions">
          <button class="btn btn-primary btn-sm" onclick="openClassDetail(${c.id})">Open →</button>
        </div>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function createClass() {
  const name = document.getElementById('new-class-name').value.trim();
  const description = document.getElementById('new-class-desc').value.trim();
  const errEl = document.getElementById('create-class-error');
  errEl.classList.add('hidden');
  if (!name) { errEl.textContent = 'Class name is required.'; errEl.classList.remove('hidden'); return; }
  try {
    await api('/api/classes', { method: 'POST', body: JSON.stringify({ name, description }) });
    document.getElementById('new-class-name').value = '';
    document.getElementById('new-class-desc').value = '';
    loadClassList();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function openClassDetail(classId) {
  currentClassId = classId;
  showView('class-detail');

  // Fetch class info
  try {
    const cls = await api(`/api/classes/${classId}`);
    document.getElementById('class-detail-title').textContent = cls.name;
    document.getElementById('class-detail-desc').textContent = cls.description || '';

    // Edit/delete controls for owner or admin
    const actions = document.getElementById('class-detail-actions');
    if (currentUser.role === 'admin' || cls.teacher_id === currentUser.id) {
      actions.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="promptEditClass(${cls.id}, '${cls.name.replace(/'/g,"\\'")}', '${(cls.description||'').replace(/'/g,"\\'")}')">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteClass(${cls.id})">🗑 Delete</button>`;
    } else {
      actions.innerHTML = '';
    }
  } catch (err) {
    document.getElementById('class-detail-title').textContent = 'Class';
  }

  // Default to calendar tab
  switchClassTab('calendar');
}

function switchClassTab(tab) {
  ['calendar','roster','stats'].forEach(t => {
    document.getElementById(`class-panel-${t}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`class-tab-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'calendar') renderClassCalendar();
  else if (tab === 'roster') loadClassRoster();
  else if (tab === 'stats') loadClassStats();
}

async function renderClassCalendar() {
  if (classCalendar) { classCalendar.destroy(); classCalendar = null; }
  const el = document.getElementById('class-calendar');
  el.innerHTML = '';

  let sessions = [];
  let attendanceMap = {};
  try {
    sessions = await api(`/api/classes/${currentClassId}/sessions`);
    // Build events from sessions
    // For each session fetch attendance summary
    await Promise.all(sessions.map(async s => {
      try {
        const records = await api(`/api/sessions/${s.id}/attendance`);
        const total = records.length;
        const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
        attendanceMap[s.session_date] = { sessionId: s.id, total, present };
      } catch (_) {
        attendanceMap[s.session_date] = { sessionId: s.id, total: 0, present: 0 };
      }
    }));
  } catch (_) {}

  const canMark = currentUser.role === 'teacher' || currentUser.role === 'admin';

  const events = sessions.map(s => {
    const info = attendanceMap[s.session_date] || { total: 0, present: 0 };
    let color = '#6b7280'; // gray — no records
    if (info.total > 0) {
      const rate = info.present / info.total;
      color = rate >= 0.8 ? '#16a34a' : rate >= 0.5 ? '#ca8a04' : '#dc2626';
    }
    return { title: info.total > 0 ? `${info.present}/${info.total}` : '📋', date: s.session_date, backgroundColor: color, borderColor: color, extendedProps: { sessionId: s.id } };
  });

  classCalendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events,
    dateClick: canMark ? info => openAttendanceSheet(currentClassId, info.dateStr) : null,
    eventClick: info => openAttendanceSheet(currentClassId, info.event.startStr),
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
  });
  classCalendar.render();

  if (canMark) {
    el.insertAdjacentHTML('afterend', '<p style="color:var(--text-muted);font-size:.82rem;margin-top:8px">Click a date to mark attendance</p>');
  }
}

async function openAttendanceSheet(classId, dateStr) {
  const overlay = document.getElementById('attendance-modal-overlay');
  const title = document.getElementById('attendance-modal-title');
  const body = document.getElementById('attendance-modal-body');
  const actionsEl = document.getElementById('attendance-modal-actions');
  title.textContent = `Attendance — ${dateStr}`;
  body.innerHTML = '<div class="loading">Loading…</div>';
  actionsEl.style.display = 'none';
  overlay.classList.remove('hidden');

  try {
    // Create/get session for this date
    const sessionRes = await api(`/api/classes/${classId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ session_date: dateStr })
    });
    currentAttendanceSessionId = sessionRes.id;

    // Get enrolled students + existing records
    const [clsData, records] = await Promise.all([
      api(`/api/classes/${classId}`),
      api(`/api/sessions/${sessionRes.id}/attendance`)
    ]);

    const students = clsData.students || [];
    const canMark = currentUser.role === 'teacher' || currentUser.role === 'admin';

    if (!students.length) {
      body.innerHTML = '<div class="empty-state">No students enrolled in this class.</div>';
      return;
    }

    const recordMap = {};
    records.forEach(r => { recordMap[r.user_id] = r; });

    const statuses = ['present','absent','late','excused'];

    body.innerHTML = `
      <div class="attendance-sheet">
        <table class="admin-table">
          <thead><tr><th>Student</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            ${students.map(s => {
              const rec = recordMap[s.user_id] || {};
              const currentStatus = rec.status || 'absent';
              if (canMark) {
                return `<tr>
                  <td>${s.name}</td>
                  <td>
                    <select class="form-input att-status-select" data-uid="${s.user_id}" style="padding:4px 8px;font-size:.85rem">
                      ${statuses.map(st => `<option value="${st}" ${currentStatus===st?'selected':''}>${st.charAt(0).toUpperCase()+st.slice(1)}</option>`).join('')}
                    </select>
                  </td>
                  <td><textarea class="form-input att-notes-input" data-uid="${s.user_id}" placeholder="Notes / feedback…" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" style="font-size:.85rem;padding:6px 10px;min-height:42px;resize:none;overflow:hidden;width:100%;line-height:1.5">${escHtml(rec.notes||'')}</textarea></td>
                </tr>`;
              } else {
                return `<tr>
                  <td>${s.name}</td>
                  <td><span class="status-badge att-${currentStatus}">${currentStatus}</span></td>
                  <td style="white-space:pre-wrap;font-size:.85rem;line-height:1.5">${escHtml(rec.notes||'—')}</td>
                </tr>`;
              }
            }).join('')}
          </tbody>
        </table>
      </div>`;

    if (canMark) actionsEl.style.display = '';
    // Auto-size textareas that already have content
    body.querySelectorAll('.att-notes-input').forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  } catch (err) {
    body.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function saveAttendance() {
  if (!currentAttendanceSessionId) return;
  const selects = document.querySelectorAll('.att-status-select');
  const notes = document.querySelectorAll('.att-notes-input');
  const records = Array.from(selects).map((sel, i) => ({
    user_id: parseInt(sel.dataset.uid),
    status: sel.value,
    notes: notes[i] ? notes[i].value.trim() : ''
  }));

  try {
    await api(`/api/sessions/${currentAttendanceSessionId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ records })
    });
    closeAttendanceModal();
    renderClassCalendar(); // refresh calendar colors
  } catch (err) {
    alert('Failed to save: ' + err.message);
  }
}

function closeAttendanceModal(event) {
  if (event && event.target !== document.getElementById('attendance-modal-overlay')) return;
  document.getElementById('attendance-modal-overlay').classList.add('hidden');
}

async function loadClassRoster() {
  const el = document.getElementById('class-roster-content');
  el.innerHTML = '<div class="loading">Loading roster…</div>';
  try {
    const cls = await api(`/api/classes/${currentClassId}`);
    const students = cls.students || [];
    const canManage = currentUser.role === 'admin' || cls.teacher_id === currentUser.id;

    let html = '';
    if (canManage) {
      // Enroll student control
      html += `
        <div class="card mb-4" style="padding:16px">
          <h4 style="margin-bottom:12px;font-size:.9rem;font-weight:600">Enroll Student</h4>
          <div style="display:flex;gap:8px;align-items:flex-end">
            <div class="form-group" style="flex:1;margin:0">
              <select id="enroll-student-select" class="form-input">
                <option value="">— Select student —</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" onclick="enrollStudentInClass()">+ Enroll</button>
          </div>
          <div id="enroll-error" class="error-msg hidden" style="margin-top:8px"></div>
        </div>`;
    }

    if (!students.length) {
      html += '<div class="empty-state">No students enrolled yet.</div>';
    } else {
      html += `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Name</th><th>Email</th>${canManage ? '<th>Actions</th>' : ''}</tr></thead>
            <tbody>
              ${students.map((s, i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${s.name}</td>
                  <td>${s.email}</td>
                  ${canManage ? `<td><button class="btn btn-xs btn-danger" onclick="unenrollStudent(${s.user_id})">Remove</button></td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
    // Insert HTML into DOM FIRST so enroll-student-select exists
    el.innerHTML = html;

    // Now populate the student dropdown (element is in DOM)
    if (canManage) {
      try {
        const allStudents = await api('/api/students');
        const enrolledIds = new Set(students.map(s => s.user_id));
        const selectEl = document.getElementById('enroll-student-select');
        if (selectEl) {
          allStudents.filter(s => !enrolledIds.has(s.id)).forEach(s => {
            selectEl.innerHTML += `<option value="${s.id}">${s.name} (${s.email})</option>`;
          });
        }
      } catch (_) {}
    }
  } catch (err) {
    el.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function enrollStudentInClass() {
  const sel = document.getElementById('enroll-student-select');
  const errEl = document.getElementById('enroll-error');
  errEl.classList.add('hidden');
  if (!sel.value) { errEl.textContent = 'Select a student first.'; errEl.classList.remove('hidden'); return; }
  try {
    await api(`/api/classes/${currentClassId}/enroll`, { method: 'POST', body: JSON.stringify({ user_id: parseInt(sel.value) }) });
    loadClassRoster();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function unenrollStudent(userId) {
  if (!confirm('Remove this student from the class?')) return;
  try {
    await api(`/api/classes/${currentClassId}/enroll/${userId}`, { method: 'DELETE' });
    loadClassRoster();
  } catch (err) {
    alert(err.message);
  }
}

async function loadClassStats() {
  const el = document.getElementById('class-stats-content');
  el.innerHTML = '<div class="loading">Loading stats…</div>';
  try {
    const stats = await api(`/api/classes/${currentClassId}/stats`);
    if (!stats.length) {
      el.innerHTML = '<div class="empty-state">No attendance records yet.</div>';
      return;
    }
    el.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Excused</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            ${stats.map(s => {
              const rate = parseFloat(s.attendance_rate||0).toFixed(0);
              const rateColor = rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626';
              return `<tr>
                <td>${s.name}</td>
                <td><span class="status-badge att-present">${s.present||0}</span></td>
                <td><span class="status-badge att-late">${s.late||0}</span></td>
                <td><span class="status-badge att-absent">${s.absent||0}</span></td>
                <td><span class="status-badge att-excused">${s.excused||0}</span></td>
                <td><strong style="color:${rateColor}">${rate}%</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function promptEditClass(classId, currentName, currentDesc) {
  const newName = prompt('Class name:', currentName);
  if (newName === null) return;
  const newDesc = prompt('Description (optional):', currentDesc);
  if (newDesc === null) return;
  try {
    await api(`/api/classes/${classId}`, { method: 'PUT', body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }) });
    openClassDetail(classId);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteClass(classId) {
  if (!confirm('Delete this class and all its attendance records? This cannot be undone.')) return;
  try {
    await api(`/api/classes/${classId}`, { method: 'DELETE' });
    showView('classes');
  } catch (err) {
    alert(err.message);
  }
}

/* My Attendance (student view) */
async function loadMyAttendance() {
  const selectorEl = document.getElementById('my-attendance-class-selector');
  const calEl = document.getElementById('my-attendance-calendar');
  const summaryEl = document.getElementById('my-attendance-summary');
  selectorEl.innerHTML = '<div class="loading">Loading classes…</div>';
  if (myAttendanceCalendar) { myAttendanceCalendar.destroy(); myAttendanceCalendar = null; }
  calEl.innerHTML = '';
  summaryEl.innerHTML = '';

  try {
    const classes = await api('/api/classes');
    if (!classes.length) {
      selectorEl.innerHTML = '<div class="empty-state">You are not enrolled in any classes.</div>';
      return;
    }

    selectorEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label style="font-weight:600">Class:</label>
        <select id="my-att-class-select" class="form-input" style="width:auto" onchange="renderMyAttendanceCalendar(this.value)">
          ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>`;

    // Auto-load first class
    renderMyAttendanceCalendar(classes[0].id);
  } catch (err) {
    selectorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function renderMyAttendanceCalendar(classId) {
  const calEl = document.getElementById('my-attendance-calendar');
  const summaryEl = document.getElementById('my-attendance-summary');
  if (myAttendanceCalendar) { myAttendanceCalendar.destroy(); myAttendanceCalendar = null; }
  calEl.innerHTML = '<div class="loading">Loading…</div>';
  summaryEl.innerHTML = '';

  try {
    const records = await api(`/api/classes/${classId}/attendance/me`);
    calEl.innerHTML = '';

    const statusColors = { present: '#16a34a', late: '#ca8a04', absent: '#dc2626', excused: '#6366f1' };
    const events = records.map(r => ({
      title: r.status,
      date: r.session_date,
      backgroundColor: statusColors[r.status] || '#6b7280',
      borderColor: statusColors[r.status] || '#6b7280',
    }));

    myAttendanceCalendar = new FullCalendar.Calendar(calEl, {
      initialView: 'dayGridMonth',
      height: 'auto',
      events,
      headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    });
    myAttendanceCalendar.render();

    // Summary counts
    const counts = { present:0, late:0, absent:0, excused:0 };
    records.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    const total = records.length;
    const rate = total ? Math.round((counts.present + counts.late) / total * 100) : 0;
    summaryEl.innerHTML = `
      <div class="attendance-summary-row">
        <span class="status-badge att-present">Present: ${counts.present}</span>
        <span class="status-badge att-late">Late: ${counts.late}</span>
        <span class="status-badge att-absent">Absent: ${counts.absent}</span>
        <span class="status-badge att-excused">Excused: ${counts.excused}</span>
        <strong>Attendance rate: ${rate}%</strong>
      </div>`;
  } catch (err) {
    calEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

/* ─── Utility ────────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Random IELTS Prompt ────────────────────────────────────────────────── */
async function _fetchCustomTask2Prompts() {
  if (Array.isArray(window._customTask2Prompts)) return; // cached
  try {
    const res = await fetch('/api/task2-prompts-custom');
    if (res.ok) window._customTask2Prompts = await res.json();
    else window._customTask2Prompts = [];
  } catch { window._customTask2Prompts = []; }
}

async function insertRandomPrompt() {
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const diff = document.getElementById('prompt-difficulty-filter')?.value || 'all';
  let bank = PROMPT_BANK[taskType] || PROMPT_BANK.task2;
  // Merge any admin-added custom prompts (task2 only)
  if (taskType === 'task2') {
    await _fetchCustomTask2Prompts();
    if (Array.isArray(window._customTask2Prompts) && window._customTask2Prompts.length) {
      bank = bank.concat(window._customTask2Prompts.map(p => ({ difficulty: p.difficulty || 'medium', q: p.q })));
    }
  }
  if (diff !== 'all') {
    const filtered = bank.filter(p => p.difficulty === diff);
    if (filtered.length) bank = filtered;
  }
  const item = bank[Math.floor(Math.random() * bank.length)];
  const ta = document.getElementById('essay-prompt');
  if (ta) ta.value = item.q || item;
}

/* ─── Weakest Criterion ──────────────────────────────────────────────────── */
function getWeakestCriterion(gradedSubmissions) {
  const withScores = gradedSubmissions.filter(s =>
    s.task_achievement != null || s.coherence_cohesion != null ||
    s.lexical_resource != null || s.grammatical_range != null
  );
  if (!withScores.length) return null;
  const keys = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range'];
  const totals = {}; const counts = {};
  keys.forEach(k => { totals[k] = 0; counts[k] = 0; });
  withScores.forEach(s => {
    keys.forEach(k => { if (s[k] != null) { totals[k] += s[k]; counts[k]++; } });
  });
  const avgs = {};
  keys.forEach(k => { avgs[k] = counts[k] ? totals[k] / counts[k] : 9; });
  const [key] = Object.entries(avgs).sort((a, b) => a[1] - b[1])[0];
  const labels = {
    task_achievement:   'Task Achievement',
    coherence_cohesion: 'Coherence & Cohesion',
    lexical_resource:   'Lexical Resource',
    grammatical_range:  'Grammatical Range & Accuracy'
  };
  return { key, label: labels[key], avg: avgs[key].toFixed(1) };
}

/* ─── Vocabulary Notebook ────────────────────────────────────────────────── */
async function loadVocabNotebook() {
  const container = document.getElementById('vocab-list-container');
  if (!container) return;
  container.innerHTML = '<div class="loading">Loading your vocabulary…</div>';
  try {
    const words = await api('/api/saved-words');
    if (!words.length) {
      container.innerHTML = '<div class="empty-state">No saved words yet. Open any essay\'s flashcards and click 💾 Save Word.</div>';
      return;
    }
    container.innerHTML = `<div class="vocab-list">${words.map(w => `
      <div class="vocab-card-item" id="vocab-item-${w.id}">
        <div class="vocab-card-main">
          <div class="vocab-word">${escapeHtml(w.word)}</div>
          ${w.definition ? `<div class="vocab-def">${escapeHtml(w.definition)}</div>` : ''}
          ${w.example ? `<div class="vocab-example">"${escapeHtml(w.example)}"</div>` : ''}
        </div>
        <button class="btn btn-danger btn-sm vocab-delete-btn" onclick="deleteVocabWord(${w.id})">🗑</button>
      </div>`).join('')}</div>`;
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Failed to load vocabulary: ${err.message}</div>`;
  }
}

async function deleteVocabWord(id) {
  try {
    await api(`/api/saved-words/${id}`, { method: 'DELETE' });
    const el = document.getElementById(`vocab-item-${id}`);
    if (el) el.remove();
    // If list is empty now, show empty state
    const list = document.querySelector('.vocab-list');
    if (list && !list.children.length) {
      document.getElementById('vocab-list-container').innerHTML =
        '<div class="empty-state">No saved words yet. Open any essay\'s flashcards and click 💾 Save Word.</div>';
    }
  } catch (err) {
    alert('Could not delete word: ' + err.message);
  }
}

async function saveFlashcardWord() {
  if (!flashcards.length) return;
  const card = flashcards[flashcardIndex];
  const btn = document.getElementById('flashcard-save-btn');
  const msg = document.getElementById('flashcard-saved-msg');
  if (btn) btn.disabled = true;
  try {
    await api('/api/saved-words', {
      method: 'POST',
      body: JSON.stringify({
        word: card.word || '',
        definition: card.definition || '',
        example: card.example || '',
        source: 'flashcard'
      })
    });
    if (msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 2500); }
  } catch (err) {
    alert('Could not save word: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ─── Notification Bell ──────────────────────────────────────────────────── */
let notifPollInterval = null;

function pollNotifications() {
  if (notifPollInterval) clearInterval(notifPollInterval);
  const doFetch = () => {
    api('/api/user/notifications').then(data => {
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      if (data.count > 0) {
        badge.textContent = data.count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }).catch(() => {});
  };
  doFetch();
  notifPollInterval = setInterval(doFetch, 60000);
}

async function openNotifPanel() {
  try {
    const data = await api('/api/user/notifications');
    await api('/api/user/notifications/read', { method: 'POST' });
    const badge = document.getElementById('notif-badge');
    if (badge) badge.classList.add('hidden');
    const lines = [];
    if (data.gradedCount > 0) lines.push(`📝 ${data.gradedCount} essay${data.gradedCount > 1 ? 's' : ''} graded`);
    if (data.newAssignments > 0) lines.push(`📋 ${data.newAssignments} new assignment${data.newAssignments > 1 ? 's' : ''}`);
    const msg = lines.length ? lines.join('\n') : 'No new notifications.';
    alert(msg);
  } catch (err) {
    alert('Could not load notifications.');
  }
}

/* ─── Speaking Topic Generator ───────────────────────────────────────────── */
let speakingPart = 1;
let speakingMode = 'ielts'; // 'ielts' | 'impromptu'
let speakingTimerInterval = null;
let speakingTimerSecs = 60;
let speakingTimerRunning = false;
let speakingPhase = 'prep'; // 'prep' | 'speak' | 'think'

function loadSpeakingTopicGen() {
  speakingMode = 'ielts';
  speakingPart = 1;
  speakingPhase = 'prep';
  // Sync mode tab UI
  const mIelts = document.getElementById('speaking-mode-ielts');
  const mImp = document.getElementById('speaking-mode-impromptu');
  if (mIelts) mIelts.classList.add('active');
  if (mImp) mImp.classList.remove('active');
  // Show part tabs
  const partTabs = document.querySelector('.speaking-part-tabs');
  if (partTabs) partTabs.style.display = '';
  resetSpeakingTimer(false);
  _updateSpeakingPartUI();
  _populateSpeakingCategories();
  spinSpeakingTopic();
}

function setSpeakingMode(mode) {
  speakingMode = mode;
  const mIelts = document.getElementById('speaking-mode-ielts');
  const mImp = document.getElementById('speaking-mode-impromptu');
  if (mIelts) mIelts.classList.toggle('active', mode === 'ielts');
  if (mImp) mImp.classList.toggle('active', mode === 'impromptu');
  // Part tabs: show in ielts mode only
  const partTabs = document.querySelector('.speaking-part-tabs');
  if (partTabs) partTabs.style.display = mode === 'ielts' ? '' : 'none';
  // Phase buttons: hide in impromptu, reset
  const phases = document.getElementById('speaking-timer-phases');
  if (mode === 'impromptu') {
    if (phases) phases.classList.add('hidden');
    speakingPhase = 'think';
  } else {
    speakingPhase = 'prep';
    _updateSpeakingPartUI(); // restores phase btn visibility
    // Ensure impromptu-specific buttons are hidden
    const speakBtn = document.getElementById('impromptu-speak-btn');
    const adjMinus = document.getElementById('speaking-adjust-minus');
    const adjPlus  = document.getElementById('speaking-adjust-plus');
    if (speakBtn) speakBtn.classList.add('hidden');
    if (adjMinus) adjMinus.classList.add('hidden');
    if (adjPlus)  adjPlus.classList.add('hidden');
  }
  clearInterval(speakingTimerInterval);
  speakingTimerRunning = false;
  // Show/hide "add more topics" reminder button (impromptu only)
  const reminderBtn = document.getElementById('impromptu-add-reminder-btn');
  const reminderBanner = document.getElementById('impromptu-reminder-banner');
  if (reminderBtn) reminderBtn.classList.toggle('hidden', mode !== 'impromptu');
  if (reminderBanner) reminderBanner.classList.add('hidden');
  _populateSpeakingCategories();
  spinSpeakingTopic();
}

function showImpromptAddReminder() {
  const banner = document.getElementById('impromptu-reminder-banner');
  if (banner) banner.classList.remove('hidden');
}

function setSpeakingPart(part) {
  speakingPart = part;
  speakingPhase = 'prep';
  clearInterval(speakingTimerInterval);
  speakingTimerRunning = false;
  _updateSpeakingPartUI();
  _populateSpeakingCategories();
  spinSpeakingTopic();
}

function _updateSpeakingPartUI() {
  [1, 2, 3].forEach(p => {
    const btn = document.getElementById(`speaking-part-btn-${p}`);
    if (btn) btn.classList.toggle('active', p === speakingPart);
  });
  // Timer phases only shown for IELTS Part 2
  const phases = document.getElementById('speaking-timer-phases');
  if (phases) phases.classList.toggle('hidden', speakingMode !== 'ielts' || speakingPart !== 2);
  // Set timer label & seconds based on part
  if (speakingPart === 1) {
    speakingTimerSecs = 30;
    _setSpeakingTimerDisplay(30);
    const lbl = document.getElementById('speaking-timer-label');
    if (lbl) lbl.textContent = 'Answer time';
  } else if (speakingPart === 2) {
    _setSpeakingPhaseDisplay('prep');
  } else {
    speakingTimerSecs = 60;
    _setSpeakingTimerDisplay(60);
    const lbl = document.getElementById('speaking-timer-label');
    if (lbl) lbl.textContent = 'Answer time';
  }
}

function _populateSpeakingCategories() {
  const sel = document.getElementById('speaking-category');
  if (!sel) return;
  let bank;
  if (speakingMode === 'impromptu') {
    bank = IMPROMPTU_BANK;
  } else {
    const key = `part${speakingPart}`;
    bank = SPEAKING_BANK[key] || [];
  }
  const cats = ['all', ...new Set(bank.map(t => t.cat))];
  sel.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${c === 'all' ? '🎲 All Categories' : c}</option>`).join('');
}

async function _fetchCustomSpeakingTopics() {
  if (Array.isArray(window._customSpeakingTopics)) return; // cached
  try {
    const res = await fetch('/api/speaking-bank-custom');
    if (res.ok) window._customSpeakingTopics = await res.json();
    else window._customSpeakingTopics = [];
  } catch { window._customSpeakingTopics = []; }
}

async function spinSpeakingTopic() {
  await _fetchCustomSpeakingTopics();
  const custom = Array.isArray(window._customSpeakingTopics) ? window._customSpeakingTopics : [];

  let bank;
  if (speakingMode === 'impromptu') {
    bank = IMPROMPTU_BANK.concat(
      custom.filter(t => t.bank === 'impromptu').map(t => ({
        cat: t.cat, difficulty: t.difficulty, q: t.q
      }))
    );
  } else {
    const key = `part${speakingPart}`;
    bank = (SPEAKING_BANK[key] || []).concat(
      custom.filter(t => t.bank === 'ielts' && String(t.part) === String(speakingPart)).map(t => ({
        cat: t.cat, difficulty: t.difficulty, q: t.q,
        ...(t.bullets ? { card: t.q, bullets: t.bullets } : {})
      }))
    );
  }

  const catSel = document.getElementById('speaking-category');
  const diffSel = document.getElementById('speaking-difficulty');
  const cat = catSel ? catSel.value : 'all';
  const diff = diffSel ? diffSel.value : 'all';

  let pool = bank;
  if (cat !== 'all') pool = pool.filter(t => t.cat === cat);
  if (diff !== 'all') pool = pool.filter(t => t.difficulty === diff);
  if (!pool.length) pool = bank; // fallback

  const item = pool[Math.floor(Math.random() * pool.length)];
  if (!item) return;

  // Animate card
  const card = document.getElementById('speaking-topic-card');
  if (card) { card.classList.add('spinning'); setTimeout(() => card.classList.remove('spinning'), 350); }

  // Update badge + category tag + difficulty tag
  const partBadge = document.getElementById('speaking-topic-part-badge');
  if (partBadge) partBadge.textContent = speakingMode === 'impromptu' ? '🎲 Impromptu' : `Part ${speakingPart}`;
  const catTag = document.getElementById('speaking-topic-category');
  if (catTag) catTag.textContent = item.cat;
  const diffTag = document.getElementById('speaking-topic-diff');
  if (diffTag) {
    diffTag.textContent = item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1);
    diffTag.className = `speaking-topic-diff-tag diff-${item.difficulty}`;
  }

  // Question or cue card
  const questionEl = document.getElementById('speaking-topic-question');
  const bulletsEl = document.getElementById('speaking-cue-bullets');
  if (speakingMode === 'ielts' && speakingPart === 2 && item.card) {
    if (questionEl) questionEl.textContent = item.card;
    if (bulletsEl) {
      bulletsEl.innerHTML = item.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('');
      bulletsEl.classList.remove('hidden');
    }
  } else {
    if (questionEl) questionEl.textContent = item.q || '';
    if (bulletsEl) bulletsEl.classList.add('hidden');
  }

  // Reset timer on each spin
  resetSpeakingTimer(false);
}

function setSpeakingPhase(phase) {
  speakingPhase = phase;
  clearInterval(speakingTimerInterval);
  speakingTimerRunning = false;
  _setSpeakingPhaseDisplay(phase);
  const startBtn = document.getElementById('speaking-timer-start-btn');
  if (startBtn) startBtn.textContent = '▶ Start';
}

function _setSpeakingPhaseDisplay(phase) {
  let secs;
  if (phase === 'think') secs = 30;
  else if (phase === 'prep') secs = 60;
  else if (phase === 'speak' && speakingMode === 'impromptu') secs = 60; // impromptu speak = 1 min
  else secs = 120; // IELTS Part 2 speak = 2 min
  speakingTimerSecs = secs;
  _setSpeakingTimerDisplay(secs);
  const lbl = document.getElementById('speaking-timer-label');
  if (lbl) {
    if (phase === 'think') lbl.textContent = 'Think time';
    else if (phase === 'prep') lbl.textContent = 'Preparation time';
    else lbl.textContent = 'Speaking time';
  }
  // Phase buttons (IELTS Part 2 only)
  ['prep', 'speak'].forEach(p => {
    const btn = document.getElementById(`phase-btn-${p}`);
    if (btn) btn.classList.toggle('active', p === phase);
  });
  // Impromptu UI: show "Speak" button only during think phase; show adjust buttons during speak phase
  const speakBtn = document.getElementById('impromptu-speak-btn');
  const adjMinus = document.getElementById('speaking-adjust-minus');
  const adjPlus  = document.getElementById('speaking-adjust-plus');
  if (speakingMode === 'impromptu') {
    if (speakBtn) speakBtn.classList.toggle('hidden', phase !== 'think');
    if (adjMinus) adjMinus.classList.toggle('hidden', phase !== 'speak');
    if (adjPlus)  adjPlus.classList.toggle('hidden',  phase !== 'speak');
  } else {
    if (speakBtn) speakBtn.classList.add('hidden');
    if (adjMinus) adjMinus.classList.add('hidden');
    if (adjPlus)  adjPlus.classList.add('hidden');
  }
}

function _setSpeakingTimerDisplay(secs) {
  const el = document.getElementById('speaking-timer-display');
  if (!el) return;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  el.classList.toggle('speaking-timer-warning', secs <= 10 && secs > 0);
  el.classList.toggle('speaking-timer-expired', secs === 0);
}

function startSpeakingTimer() {
  const startBtn = document.getElementById('speaking-timer-start-btn');
  if (speakingTimerRunning) {
    // Pause
    clearInterval(speakingTimerInterval);
    speakingTimerRunning = false;
    if (startBtn) startBtn.textContent = '▶ Resume';
    return;
  }
  if (speakingTimerSecs <= 0) { resetSpeakingTimer(false); return; }
  speakingTimerRunning = true;
  if (startBtn) startBtn.textContent = '⏸ Pause';
  speakingTimerInterval = setInterval(() => {
    speakingTimerSecs--;
    _setSpeakingTimerDisplay(speakingTimerSecs);
    if (speakingTimerSecs <= 0) {
      clearInterval(speakingTimerInterval);
      speakingTimerRunning = false;
      if (startBtn) startBtn.textContent = '▶ Start';
      // Auto-switch: Part 2 prep → speak, Impromptu think → speak
      if (speakingMode === 'ielts' && speakingPart === 2 && speakingPhase === 'prep') {
        setTimeout(() => setSpeakingPhase('speak'), 400);
      } else if (speakingMode === 'impromptu' && speakingPhase === 'think') {
        setTimeout(() => setSpeakingPhase('speak'), 400);
      }
    }
  }, 1000);
}

function resetSpeakingTimer(restart = false) {
  clearInterval(speakingTimerInterval);
  speakingTimerRunning = false;
  const startBtn = document.getElementById('speaking-timer-start-btn');
  if (startBtn) startBtn.textContent = '▶ Start';
  if (speakingMode === 'impromptu') {
    speakingPhase = 'think';
    _setSpeakingPhaseDisplay('think');
  } else if (speakingPart === 2) {
    _setSpeakingPhaseDisplay(speakingPhase);
  } else if (speakingPart === 1) {
    speakingTimerSecs = 30;
    _setSpeakingTimerDisplay(30);
  } else {
    speakingTimerSecs = 60;
    _setSpeakingTimerDisplay(60);
  }
  if (restart) startSpeakingTimer();
}

function startImpromtuSpeak() {
  // Switch to speak phase and immediately start the 1-minute timer
  setSpeakingPhase('speak');
  startSpeakingTimer();
}

function adjustSpeakingTimer(delta) {
  speakingTimerSecs = Math.max(10, speakingTimerSecs + delta);
  _setSpeakingTimerDisplay(speakingTimerSecs);
}

/* ─── Vocabulary Learning Module ─────────────────────────────────────────── */
function loadVocabLearn() {
  // Render topic chips
  const topicChips = document.getElementById('vl-topic-chips');
  if (topicChips) {
    topicChips.innerHTML = Object.keys(VOCAB_BANK).map(t =>
      `<button class="vl-chip${t === vocabTopic ? ' active' : ''}" onclick="selectVocabTopic('${escapeHtml(t)}')">${t}</button>`
    ).join('');
  }
  // Set active level chip
  document.querySelectorAll('.vl-level-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === vocabLevel);
  });
  renderVocabWordPreview();
  // Show picker, hide game
  document.getElementById('vl-picker')?.classList.remove('hidden');
  document.getElementById('vl-game')?.classList.add('hidden');
}

function selectVocabTopic(t) {
  vocabTopic = t;
  document.querySelectorAll('#vl-topic-chips .vl-chip').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === t);
  });
  renderVocabWordPreview();
}

function selectVocabLevel(l) {
  vocabLevel = l;
  document.querySelectorAll('.vl-level-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === l);
  });
  renderVocabWordPreview();
}

function renderVocabWordPreview() {
  const preview = document.getElementById('vl-word-preview');
  if (!preview) return;
  const words = _getVocabWords();
  if (!words.length) {
    preview.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">No words for this selection.</p>';
    return;
  }
  preview.innerHTML = `
    <div class="vl-word-table-header">${words.length} words · click row to expand</div>
    <div class="vl-word-table">
      ${words.map((w, i) => `
        <div class="vl-word-row" onclick="toggleVlRow(${i})">
          <div class="vl-word-row-main">
            <span class="vl-wt-word">${escapeHtml(w.word)}</span>
            <span class="vl-wt-vn">${escapeHtml(w.vietnamese)}</span>
            <span class="vl-wt-def">${escapeHtml(w.definition)}</span>
            <span class="vl-wt-chevron">›</span>
          </div>
          <div class="vl-word-row-detail hidden" id="vl-row-detail-${i}">
            <div class="vl-wt-colloc">📎 ${w.collocations.map(c => escapeHtml(c)).join(' · ')}</div>
            <div class="vl-wt-example">"${escapeHtml(w.example)}"</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function toggleVlRow(i) {
  const detail = document.getElementById(`vl-row-detail-${i}`);
  const row = detail?.closest('.vl-word-row');
  if (!detail) return;
  const isOpen = !detail.classList.contains('hidden');
  detail.classList.toggle('hidden', isOpen);
  row?.classList.toggle('vl-row-open', !isOpen);
}

function _getVocabWords() {
  return (VOCAB_BANK[vocabTopic] || {})[vocabLevel] || [];
}

function _shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _showVocabGame(title) {
  document.getElementById('vl-picker')?.classList.add('hidden');
  const gameDiv = document.getElementById('vl-game');
  if (gameDiv) gameDiv.classList.remove('hidden');
  const titleEl = document.getElementById('vl-game-title');
  if (titleEl) titleEl.textContent = title;
  const resultDiv = document.getElementById('vl-game-result');
  if (resultDiv) resultDiv.classList.add('hidden');
}

function exitVocabGame() {
  document.getElementById('vl-picker')?.classList.remove('hidden');
  document.getElementById('vl-game')?.classList.add('hidden');
  _vocabGameWords = [];
  _vocabGameIndex = 0;
  _vocabScore = 0;
}

function _updateVocabProgress(current, total) {
  const el = document.getElementById('vl-game-progress');
  if (el) el.textContent = `${current} / ${total}`;
}

// ── Flip Cards ────────────────────────────────────────────────────────────
function startVocabFlip() {
  const words = _getVocabWords();
  if (!words.length) { alert('No words available for this topic & level.'); return; }
  _vocabGameWords = _shuffleArray(words);
  _vocabGameIndex = 0;
  _showVocabGame('🃏 Flip Cards');
  renderFlipCard(0);
}

function renderFlipCard(idx) {
  const words = _vocabGameWords;
  _updateVocabProgress(idx + 1, words.length);
  const w = words[idx];
  const body = document.getElementById('vl-game-body');
  if (!body) return;
  body.innerHTML = `
    <div class="flashcard-scene" id="vl-flip-scene" onclick="flipVocabCard()" style="cursor:pointer;margin:0 auto 16px;display:block">
      <div class="flashcard-card" id="vl-flip-card">
        <div class="flashcard-front" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px">
          <div style="font-size:32px;font-weight:800;color:var(--primary)">${escapeHtml(w.word)}</div>
          <div style="margin-top:8px;font-size:13px;color:var(--text-secondary)">Click to reveal</div>
        </div>
        <div class="flashcard-back" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center">
          <div style="font-size:15px;font-weight:600;margin-bottom:4px">${escapeHtml(w.definition)}</div>
          <div class="flashcard-vn">${escapeHtml(w.vietnamese)}</div>
          <div class="flashcard-colloc">${w.collocations.map(c => escapeHtml(c)).join(' · ')}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;font-style:italic">"${escapeHtml(w.example)}"</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-secondary btn-sm" onclick="renderFlipCard(Math.max(0,${idx}-1))" ${idx===0?'disabled':''}>← Prev</button>
      <button class="btn btn-outline btn-sm" onclick="flipVocabCard()">🔄 Flip</button>
      <button class="btn btn-primary btn-sm" onclick="${idx < words.length-1 ? `renderFlipCard(${idx+1})` : 'showVocabFlipResult()'}">
        ${idx < words.length-1 ? 'Next →' : '🏁 Finish'}
      </button>
      <button class="btn btn-outline btn-sm" onclick="saveVocabWordToNotebook(${idx})">💾 Save</button>
    </div>`;
}

function flipVocabCard() {
  document.getElementById('vl-flip-card')?.classList.toggle('flipped');
}

function showVocabFlipResult() {
  _showVocabResult('Flip Cards complete!', _vocabGameWords.length, _vocabGameWords.length, 'You reviewed all cards. Try a quiz to test yourself!');
}

async function saveVocabWordToNotebook(idx) {
  if (!token) { alert('Please log in to save words.'); return; }
  const w = _vocabGameWords[idx];
  try {
    await api('/api/saved-words', {
      method: 'POST',
      body: JSON.stringify({
        word: w.word,
        definition: `${w.definition} 🇻🇳 ${w.vietnamese}`,
        example: w.example,
        source: `Vocab Learning (${vocabTopic} · ${vocabLevel})`
      })
    });
    showToast('Word saved to My Vocabulary!');
  } catch (err) { alert('Save failed: ' + err.message); }
}

// ── Multiple Choice Quiz ──────────────────────────────────────────────────
function startVocabQuiz() {
  const words = _getVocabWords();
  if (words.length < 4) { alert('Need at least 4 words for a quiz.'); return; }
  _vocabGameWords = _shuffleArray(words);
  _vocabGameIndex = 0;
  _vocabScore = 0;
  _showVocabGame('🎯 Quiz');
  renderQuizQuestion(0);
}

function renderQuizQuestion(idx) {
  const words = _vocabGameWords;
  _updateVocabProgress(idx + 1, words.length);
  const correct = words[idx];
  // Pick 3 wrong distractors from same topic+level pool
  const allWords = _getVocabWords();
  const distractors = _shuffleArray(allWords.filter(w => w.word !== correct.word)).slice(0, 3);
  const options = _shuffleArray([correct, ...distractors]);
  const body = document.getElementById('vl-game-body');
  if (!body) return;
  body.innerHTML = `
    <div class="vl-quiz-question">${escapeHtml(correct.word)}</div>
    <div style="font-size:13px;color:var(--text-secondary);text-align:center;margin-bottom:16px">🇻🇳 ${escapeHtml(correct.vietnamese)}</div>
    <div class="vl-quiz-options" id="vl-quiz-opts">
      ${options.map((opt, i) => `
        <button class="vl-quiz-opt" id="vl-opt-${i}" onclick="checkQuizAnswer(${i}, ${options.findIndex(o=>o===correct)}, ${idx})">
          ${escapeHtml(opt.definition)}
        </button>
      `).join('')}
    </div>
    <div id="vl-quiz-feedback" style="text-align:center;margin-top:12px;font-weight:600;min-height:24px"></div>`;
}

function checkQuizAnswer(chosen, correct, idx) {
  // Disable all buttons
  document.querySelectorAll('.vl-quiz-opt').forEach(btn => btn.disabled = true);
  const chosenBtn = document.getElementById(`vl-opt-${chosen}`);
  const correctBtn = document.getElementById(`vl-opt-${correct}`);
  const feedback = document.getElementById('vl-quiz-feedback');
  const isCorrect = chosen === correct;
  if (isCorrect) {
    chosenBtn?.classList.add('correct');
    _vocabScore++;
    if (feedback) feedback.textContent = '✅ Correct!';
  } else {
    chosenBtn?.classList.add('wrong');
    correctBtn?.classList.add('correct');
    if (feedback) feedback.textContent = `❌ Correct answer highlighted`;
  }
  const nextIdx = idx + 1;
  const body = document.getElementById('vl-game-body');
  if (body) {
    const nextBtn = document.createElement('div');
    nextBtn.style.cssText = 'text-align:center;margin-top:16px';
    nextBtn.innerHTML = nextIdx < _vocabGameWords.length
      ? `<button class="btn btn-primary btn-sm" onclick="renderQuizQuestion(${nextIdx})">Next →</button>`
      : `<button class="btn btn-primary btn-sm" onclick="showVocabQuizResult()">See Results 🏁</button>`;
    body.appendChild(nextBtn);
  }
}

function showVocabQuizResult() {
  _showVocabResult('Quiz Complete!', _vocabScore, _vocabGameWords.length);
}

// ── Typing Test ───────────────────────────────────────────────────────────
function startVocabTyping() {
  const words = _getVocabWords();
  if (!words.length) { alert('No words available.'); return; }
  _vocabGameWords = _shuffleArray(words);
  _vocabGameIndex = 0;
  _vocabScore = 0;
  _showVocabGame('⌨️ Typing Test');
  renderTypingQuestion(0);
}

function renderTypingQuestion(idx) {
  const words = _vocabGameWords;
  _updateVocabProgress(idx + 1, words.length);
  const w = words[idx];
  const body = document.getElementById('vl-game-body');
  if (!body) return;
  body.innerHTML = `
    <div class="vl-typing-def">${escapeHtml(w.definition)}</div>
    <div class="vl-typing-vn">🇻🇳 ${escapeHtml(w.vietnamese)}</div>
    <input type="text" id="vl-typing-input" class="vl-typing-input" placeholder="Type the word…"
      onkeydown="if(event.key==='Enter') checkTypingAnswer(${idx})" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
      <button class="btn btn-primary btn-sm" onclick="checkTypingAnswer(${idx})">Check ✓</button>
      <button class="btn btn-outline btn-sm" onclick="skipTypingAnswer(${idx})">Skip →</button>
    </div>
    <div id="vl-typing-feedback" style="text-align:center;margin-top:10px;font-weight:600;min-height:22px"></div>`;
  setTimeout(() => document.getElementById('vl-typing-input')?.focus(), 50);
}

function checkTypingAnswer(idx) {
  const input = document.getElementById('vl-typing-input');
  const feedback = document.getElementById('vl-typing-feedback');
  if (!input) return;
  const answer = input.value.trim().toLowerCase();
  const correct = _vocabGameWords[idx].word.toLowerCase();
  input.disabled = true;
  if (answer === correct) {
    input.classList.add('correct');
    if (feedback) feedback.textContent = '✅ Correct!';
    _vocabScore++;
    _advanceTyping(idx);
  } else {
    input.classList.add('wrong');
    if (feedback) feedback.innerHTML = `❌ Answer: <strong>${escapeHtml(_vocabGameWords[idx].word)}</strong>`;
    _advanceTyping(idx);
  }
}

function skipTypingAnswer(idx) {
  const feedback = document.getElementById('vl-typing-feedback');
  if (feedback) feedback.innerHTML = `⏭ Skipped — answer: <strong>${escapeHtml(_vocabGameWords[idx].word)}</strong>`;
  const input = document.getElementById('vl-typing-input');
  if (input) { input.disabled = true; input.classList.add('wrong'); }
  _advanceTyping(idx);
}

function _advanceTyping(idx) {
  const nextIdx = idx + 1;
  const body = document.getElementById('vl-game-body');
  if (!body) return;
  const nextBtn = document.createElement('div');
  nextBtn.style.cssText = 'text-align:center;margin-top:12px';
  nextBtn.innerHTML = nextIdx < _vocabGameWords.length
    ? `<button class="btn btn-primary btn-sm" onclick="renderTypingQuestion(${nextIdx})">Next →</button>`
    : `<button class="btn btn-primary btn-sm" onclick="showVocabTypingResult()">See Results 🏁</button>`;
  body.appendChild(nextBtn);
}

function showVocabTypingResult() {
  _showVocabResult('Typing Test Complete!', _vocabScore, _vocabGameWords.length);
}

// ── Matching Pairs ────────────────────────────────────────────────────────
function startVocabMatching() {
  const words = _getVocabWords();
  if (words.length < 4) { alert('Need at least 4 words for matching.'); return; }
  const picked = _shuffleArray(words).slice(0, 6);
  _vocabGameWords = picked;
  _vocabScore = 0;
  _vocabMatchSelected = null;
  _vocabMatchPaired = new Set();
  _showVocabGame('🔗 Matching');
  renderMatchingGame();
}

function renderMatchingGame() {
  const words = _vocabGameWords;
  _updateVocabProgress(_vocabMatchPaired.size / 2, words.length);
  const shuffledDefs = _shuffleArray(words.map((w, i) => ({ def: w.definition, idx: i })));
  const body = document.getElementById('vl-game-body');
  if (!body) return;
  body.innerHTML = `
    <p style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:12px">Match each word with its definition</p>
    <div class="vl-match-grid" id="vl-match-grid">
      <div id="vl-words-col">
        ${words.map((w, i) => `
          <div class="vl-match-item" id="vl-word-${i}" data-col="word" data-idx="${i}" onclick="selectMatchItem('word',${i})">
            ${escapeHtml(w.word)}
          </div>`).join('')}
      </div>
      <div id="vl-defs-col">
        ${shuffledDefs.map((d, i) => `
          <div class="vl-match-item" id="vl-def-${d.idx}" data-col="def" data-idx="${d.idx}" onclick="selectMatchItem('def',${d.idx})">
            ${escapeHtml(d.def)}
          </div>`).join('')}
      </div>
    </div>`;
}

function selectMatchItem(col, idx) {
  const el = document.getElementById(`vl-${col === 'word' ? 'word' : 'def'}-${idx}`);
  if (!el || _vocabMatchPaired.has(idx + '-' + col)) return; // already matched

  if (!_vocabMatchSelected) {
    // First selection
    _vocabMatchSelected = { col, idx };
    el.classList.add('selected');
    return;
  }

  const prev = _vocabMatchSelected;

  // Same column: switch selection
  if (prev.col === col) {
    document.getElementById(`vl-${prev.col === 'word' ? 'word' : 'def'}-${prev.idx}`)?.classList.remove('selected');
    _vocabMatchSelected = { col, idx };
    el.classList.add('selected');
    return;
  }

  // Cross-column: check match
  const wordIdx = col === 'word' ? idx : prev.idx;
  const defIdx  = col === 'def'  ? idx : prev.idx;

  document.getElementById(`vl-word-${prev.col === 'word' ? prev.idx : idx}`)?.classList.remove('selected');
  document.getElementById(`vl-def-${prev.col === 'def' ? prev.idx : idx}`)?.classList.remove('selected');

  if (wordIdx === defIdx) {
    // Correct pair
    document.getElementById(`vl-word-${wordIdx}`)?.classList.add('matched');
    document.getElementById(`vl-def-${wordIdx}`)?.classList.add('matched');
    _vocabMatchPaired.add(wordIdx + '-word');
    _vocabMatchPaired.add(wordIdx + '-def');
    _vocabScore++;
    _updateVocabProgress(_vocabScore, _vocabGameWords.length);
    if (_vocabScore === _vocabGameWords.length) {
      setTimeout(() => _showVocabResult('Matching Complete!', _vocabScore, _vocabGameWords.length), 400);
    }
  } else {
    // Wrong pair — flash red
    const wordEl = document.getElementById(`vl-word-${wordIdx}`);
    const defEl  = document.getElementById(`vl-def-${defIdx}`);
    wordEl?.classList.add('wrong');
    defEl?.classList.add('wrong');
    setTimeout(() => { wordEl?.classList.remove('wrong'); defEl?.classList.remove('wrong'); }, 600);
  }
  _vocabMatchSelected = null;
}

// ── Result Screen ─────────────────────────────────────────────────────────
function _showVocabResult(title, score, total, message) {
  const resultDiv = document.getElementById('vl-game-result');
  if (!resultDiv) return;
  document.getElementById('vl-game-body').innerHTML = '';
  const pct = Math.round((score / total) * 100);
  const msg = message || (pct === 100 ? '🎉 Perfect score!' : pct >= 70 ? '👍 Great work!' : '💪 Keep practising!');
  resultDiv.innerHTML = `
    <div class="vl-result">
      <div class="vl-result-score">${score}/${total}</div>
      <div class="vl-result-label">${msg}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="exitVocabGame();loadVocabLearn()">← Pick Another</button>
        <button class="btn btn-outline btn-sm" onclick="startVocabFlip()">🃏 Flip Cards</button>
        <button class="btn btn-outline btn-sm" onclick="startVocabQuiz()">🎯 Quiz Again</button>
        <button class="btn btn-outline btn-sm" onclick="startVocabMatching()">🔗 Matching</button>
      </div>
    </div>`;
  resultDiv.classList.remove('hidden');
  const titleEl = document.getElementById('vl-game-title');
  if (titleEl) titleEl.textContent = title;
}

