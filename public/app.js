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
    { difficulty: 'easy', topic: 'Education', q: 'Some people believe that universities should only offer courses that are useful for employment. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', topic: 'Society', q: 'In many countries, the proportion of older people is steadily increasing. Do you think this is a positive or negative development? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', topic: 'Technology', q: 'The increasing use of technology in the classroom is helping students learn more effectively. To what extent do you agree or disagree with this statement? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', topic: 'Technology', q: 'Many people believe that social networking sites such as Facebook have had a huge negative impact on both individuals and society. To what extent do you agree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', topic: 'Crime & Law', q: 'The best way to reduce crime is to give longer prison sentences. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', topic: 'Technology', q: 'Some countries spend large amounts of money on space exploration programmes. Do you think this money could be better spent? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'easy', topic: 'Education', q: 'It is argued that getting a university education is the best way to guarantee a successful career. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'easy', topic: 'Environment', q: 'Governments should spend money on railways rather than building new roads. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    // Medium — discuss both sides, causes/solutions, or advantages/disadvantages
    { difficulty: 'medium', topic: 'Education', q: 'Some people think that a sense of competition in children should be encouraged. Others believe that children who are taught to cooperate rather than compete become more useful adults. Discuss both these views and give your own opinion.' },
    { difficulty: 'medium', topic: 'Society', q: 'Some people say that advertising encourages us to buy things we do not really need. Others say that advertisements tell us about new products that may improve our lives. Discuss both views and give your own opinion.' },
    { difficulty: 'medium', topic: 'Education', q: 'In some countries, the government pays for university education. In other countries, students must pay for themselves. Discuss the advantages and disadvantages of government-funded university education.' },
    { difficulty: 'medium', topic: 'Environment', q: 'Traffic congestion is becoming a huge problem in many cities around the world. What are the causes of this problem, and what measures could be taken to reduce it? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', topic: 'Education', q: 'Some people think that parents should teach children how to be good members of society. Others, however, believe that school is the place to learn this. Discuss both these views and give your own opinion.' },
    { difficulty: 'medium', topic: 'Society', q: 'In some parts of the world, traditional festivals and celebrations are disappearing. Why is this happening, and is it a positive or negative development? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', topic: 'Society', q: 'Many people prefer to watch foreign films rather than locally produced films. Why could this be? Should governments give more financial support to local film industries? Give reasons for your answer.' },
    { difficulty: 'medium', topic: 'Society', q: 'More and more people are choosing to live and work abroad. What are the reasons for this, and do the advantages outweigh the disadvantages? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', topic: 'Environment', q: 'Some people feel that manufacturers and supermarkets have the responsibility to reduce the amount of packaging of goods. Others argue that it is the responsibility of consumers. Discuss both views and give your own opinion.' },
    { difficulty: 'medium', topic: 'Education', q: 'Some people think that the main purpose of schools is to turn children into good citizens and workers, rather than to benefit them as individuals. To what extent do you agree or disagree?' },
    { difficulty: 'medium', topic: 'Technology', q: 'Many people are afraid that artificial intelligence will replace human workers in the near future. Do the advantages of AI outweigh the disadvantages? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', topic: 'Health', q: 'Children today spend less time playing outdoors and more time on screens. What are the reasons for this, and what are the consequences? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'medium', topic: 'Health', q: 'Nowadays, people are living longer than ever before. What problems does this create and what solutions can you suggest? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    { difficulty: 'medium', topic: 'Environment', q: 'The world is consuming far more natural resources than it did in the past. What are the reasons for this, and what can be done to stop it? Give reasons for your answer and include any relevant examples from your own knowledge or experience.' },
    // Hard — abstract, multi-layered, or nuanced arguments
    { difficulty: 'hard', topic: 'Work & Career', q: 'Many governments think that economic progress is their most important goal. Some people, however, think that other types of progress are equally important for a country. Discuss both these views and give your own opinion.' },
    { difficulty: 'hard', topic: 'Environment', q: 'The best way to solve the world\'s environmental problems is to increase the price of fuel. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples.' },
    { difficulty: 'hard', topic: 'Society', q: 'Some people believe that it is better to accept a bad situation than to try to change it. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples.' },
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
  'Technology': {
    B1: [
      { word: 'automation',      definition: 'Using machines or technology to perform tasks with minimal human effort', vietnamese: 'tự động hóa',       collocations: ['factory automation', 'automation of jobs'],           example: 'Automation has replaced many manual jobs in factories.' },
      { word: 'digital',         definition: 'Relating to technology that uses binary code to store or transmit data',  vietnamese: 'kỹ thuật số',       collocations: ['digital media', 'digital literacy'],                   example: 'Most newspapers have moved to digital platforms.' },
      { word: 'device',          definition: 'A piece of equipment made for a specific purpose',                        vietnamese: 'thiết bị',          collocations: ['mobile device', 'smart device'],                       example: 'Smartphones are the most widely used digital devices.' },
      { word: 'software',        definition: 'Programs and operating information used by a computer',                   vietnamese: 'phần mềm',          collocations: ['software update', 'install software'],                 example: 'The latest software update fixed several security issues.' },
      { word: 'connect',         definition: 'To link people or systems electronically',                                vietnamese: 'kết nối',           collocations: ['connect to the internet', 'stay connected'],           example: 'The internet connects billions of people worldwide.' },
      { word: 'access',          definition: 'The ability or right to use something',                                   vietnamese: 'truy cập / tiếp cận', collocations: ['internet access', 'access to technology'],           example: 'Not everyone has equal access to digital technology.' },
      { word: 'online',          definition: 'Connected to or available through the internet',                          vietnamese: 'trực tuyến',        collocations: ['online learning', 'go online'],                        example: 'Online shopping has grown dramatically in recent years.' },
      { word: 'network',         definition: 'A system of interconnected computers or people',                          vietnamese: 'mạng lưới',         collocations: ['social network', 'computer network'],                  example: 'Social networks allow people to share ideas globally.' },
      { word: 'screen',          definition: 'Time spent looking at a digital display',                                 vietnamese: 'màn hình',          collocations: ['screen time', 'reduce screen time'],                   example: 'Excessive screen time can harm children\'s development.' },
      { word: 'data',            definition: 'Information collected and stored electronically',                         vietnamese: 'dữ liệu',           collocations: ['collect data', 'data breach'],                         example: 'Companies collect vast amounts of user data every day.' },
      { word: 'skill',           definition: 'The ability to do something well through practice',                       vietnamese: 'kỹ năng',           collocations: ['digital skill', 'technical skill'],                    example: 'Digital skills are increasingly important in the workplace.' },
      { word: 'internet',        definition: 'The global system linking computers worldwide',                            vietnamese: 'internet',          collocations: ['internet connection', 'internet access'],              example: 'Fast internet access is now essential for remote work.' },
    ],
    B2: [
      { word: 'digital literacy',  definition: 'The ability to use digital technology effectively and critically',    vietnamese: 'hiểu biết kỹ thuật số', collocations: ['promote digital literacy', 'digital literacy skills'],  example: 'Schools must promote digital literacy among young students.' },
      { word: 'cybersecurity',     definition: 'The protection of computer systems from digital attacks or theft',    vietnamese: 'an ninh mạng',          collocations: ['cybersecurity threat', 'improve cybersecurity'],         example: 'Cybersecurity is a growing concern for businesses globally.' },
      { word: 'data privacy',      definition: 'The right to control how personal data is collected and used',        vietnamese: 'quyền riêng tư dữ liệu', collocations: ['data privacy law', 'protect data privacy'],            example: 'Data privacy laws aim to protect users from exploitation.' },
      { word: 'digital divide',    definition: 'The gap between those who have access to technology and those who do not', vietnamese: 'khoảng cách số',   collocations: ['bridge the digital divide', 'widen the digital divide'], example: 'The digital divide between rich and poor nations is growing.' },
      { word: 'artificial intelligence', definition: 'Computer systems that perform tasks normally requiring human intelligence', vietnamese: 'trí tuệ nhân tạo', collocations: ['artificial intelligence technology', 'AI-powered tool'], example: 'Artificial intelligence is transforming the healthcare industry.' },
      { word: 'facilitate',        definition: 'To make a process easier or help it happen',                          vietnamese: 'tạo điều kiện, hỗ trợ', collocations: ['facilitate communication', 'facilitate learning'],      example: 'Technology facilitates communication across long distances.' },
      { word: 'foster',            definition: 'To encourage the development of something',                            vietnamese: 'thúc đẩy, nuôi dưỡng', collocations: ['foster innovation', 'foster creativity'],               example: 'Online platforms foster collaboration among global teams.' },
      { word: 'superficial',       definition: 'Appearing real or important but lacking depth',                        vietnamese: 'hời hợt, bề ngoài',    collocations: ['superficial interaction', 'superficial understanding'],  example: 'Critics argue that social media encourages superficial relationships.' },
      { word: 'interpersonal skills', definition: 'The ability to communicate and interact effectively with others',  vietnamese: 'kỹ năng giao tiếp',    collocations: ['develop interpersonal skills', 'interpersonal skills training'], example: 'Over-reliance on technology may reduce interpersonal skills.' },
      { word: 'articulate',        definition: 'Having or showing the ability to express ideas clearly',               vietnamese: 'diễn đạt rõ ràng',     collocations: ['articulate ideas', 'clearly articulate'],               example: 'Students who read widely tend to articulate ideas more clearly.' },
      { word: 'nuance',            definition: 'A subtle difference in meaning, tone, or understanding',               vietnamese: 'sắc thái, tinh tế',    collocations: ['grasp nuance', 'cultural nuance'],                       example: 'Online communication often lacks the nuance of face-to-face interaction.' },
      { word: 'exacerbate',        definition: 'To make a problem or situation worse',                                 vietnamese: 'làm trầm trọng thêm',  collocations: ['exacerbate inequality', 'exacerbate the problem'],       example: 'Social media can exacerbate cyberbullying among teenagers.' },
    ],
    C1: [
      { word: 'algorithmic bias',  definition: 'When AI systems produce unfair or discriminatory outcomes due to flawed data', vietnamese: 'sai lệch thuật toán', collocations: ['address algorithmic bias', 'algorithmic bias in hiring'],  example: 'Algorithmic bias in hiring tools can perpetuate discrimination.' },
      { word: 'disruptive innovation', definition: 'A technology that displaces established markets or products',     vietnamese: 'đổi mới phá vỡ',      collocations: ['disruptive innovation in finance', 'create disruption'],   example: 'Streaming services represented a disruptive innovation for television.' },
      { word: 'technological unemployment', definition: 'Job losses caused by automation or technology replacing workers', vietnamese: 'thất nghiệp do công nghệ', collocations: ['risk of technological unemployment', 'address technological unemployment'], example: 'Governments must address technological unemployment through retraining schemes.' },
      { word: 'data sovereignty',  definition: 'The idea that data is subject to the laws of the country where it is stored', vietnamese: 'chủ quyền dữ liệu', collocations: ['data sovereignty laws', 'protect data sovereignty'],       example: 'Data sovereignty has become a key issue in international trade agreements.' },
      { word: 'proliferation',     definition: 'A rapid increase in the number of something',                          vietnamese: 'sự gia tăng nhanh chóng', collocations: ['proliferation of technology', 'rapid proliferation'],   example: 'The proliferation of smartphones has transformed daily life.' },
      { word: 'misinformation',    definition: 'False or inaccurate information spread without intent to deceive',     vietnamese: 'thông tin sai lệch',    collocations: ['spread misinformation', 'combat misinformation'],         example: 'Social media platforms are accused of enabling the spread of misinformation.' },
      { word: 'surveillance',      definition: 'Close monitoring of people using technology',                           vietnamese: 'giám sát',              collocations: ['mass surveillance', 'government surveillance'],           example: 'Mass surveillance raises serious concerns about civil liberties.' },
      { word: 'asynchronous',      definition: 'Not occurring at the same time; allowing flexible timing',              vietnamese: 'không đồng bộ',         collocations: ['asynchronous communication', 'asynchronous learning'],    example: 'Asynchronous learning allows students to study at their own pace.' },
      { word: 'automation bias',   definition: 'The tendency to over-rely on automated systems',                        vietnamese: 'sự thiên lệch tự động hóa', collocations: ['automation bias risk', 'reduce automation bias'],      example: 'Automation bias can lead to dangerous errors in medical diagnosis.' },
      { word: 'digital footprint', definition: 'The trail of data left by a user\'s online activity',                  vietnamese: 'dấu vết kỹ thuật số',  collocations: ['digital footprint management', 'leave a digital footprint'], example: 'Employers increasingly check candidates\' digital footprints.' },
      { word: 'echo chamber',      definition: 'An environment where a person\'s beliefs are reinforced by like-minded content', vietnamese: 'buồng vang', collocations: ['social media echo chamber', 'escape the echo chamber'],  example: 'Social media algorithms can trap users in echo chambers.' },
      { word: 'platform economy',  definition: 'An economic model based on digital platforms connecting buyers and sellers', vietnamese: 'kinh tế nền tảng', collocations: ['growth of the platform economy', 'platform economy regulation'], example: 'The platform economy has created new forms of flexible but precarious work.' },
    ],
    C2: [
      { word: 'techno-solutionism', definition: 'The belief that technology can solve all social and political problems', vietnamese: 'chủ nghĩa giải quyết bằng công nghệ', collocations: ['critique of techno-solutionism', 'techno-solutionist mindset'], example: 'Critics of techno-solutionism argue that poverty requires policy, not apps.' },
      { word: 'net neutrality',    definition: 'The principle that all internet traffic should be treated equally',      vietnamese: 'trung lập mạng',        collocations: ['net neutrality debate', 'protect net neutrality'],        example: 'Net neutrality ensures that internet service providers cannot block content.' },
      { word: 'posthumanism',      definition: 'A philosophical movement questioning the centrality of the human in an age of AI', vietnamese: 'chủ nghĩa hậu nhân văn', collocations: ['posthumanist theory', 'posthumanism and AI'],          example: 'Posthumanism raises profound questions about identity in a digital age.' },
      { word: 'epistemic bubble',  definition: 'A situation where a person only encounters information confirming their views', vietnamese: 'bong bóng nhận thức', collocations: ['epistemic bubble online', 'burst the epistemic bubble'],  example: 'Personalised algorithms contribute to epistemic bubbles in modern society.' },
      { word: 'regulatory capture', definition: 'When regulatory agencies serve the interests of the industries they regulate', vietnamese: 'sự chiếm đoạt quy định', collocations: ['regulatory capture in tech', 'risk of regulatory capture'], example: 'Regulatory capture is a concern when tech giants lobby for lenient rules.' },
      { word: 'technological determinism', definition: 'The theory that technology drives social change independent of human agency', vietnamese: 'thuyết quyết định công nghệ', collocations: ['technological determinism debate', 'critique technological determinism'], example: 'Technological determinism overstates the role of machines in shaping society.' },
      { word: 'datafication',      definition: 'The process of turning aspects of social life into quantifiable data',    vietnamese: 'số hóa dữ liệu xã hội', collocations: ['datafication of behaviour', 'datafication of education'],  example: 'The datafication of education raises privacy and equity concerns.' },
      { word: 'cognitive offloading', definition: 'Using technology to store or process information instead of the human brain', vietnamese: 'giảm tải nhận thức', collocations: ['cognitive offloading via smartphones', 'risk of cognitive offloading'], example: 'Cognitive offloading onto devices may reduce our capacity for deep thinking.' },
    ],
  },
  'Environment': {
    B1: [
      { word: 'pollution',         definition: 'The presence of harmful substances in the environment',                 vietnamese: 'ô nhiễm',           collocations: ['air pollution', 'reduce pollution'],                   example: 'Air pollution in cities causes serious respiratory problems.' },
      { word: 'renewable energy',  definition: 'Energy from a source that is naturally replenished, such as solar or wind', vietnamese: 'năng lượng tái tạo', collocations: ['invest in renewable energy', 'switch to renewable energy'], example: 'Governments must invest in renewable energy to reduce carbon emissions.' },
      { word: 'carbon emissions',  definition: 'Carbon dioxide released into the atmosphere from burning fuels',        vietnamese: 'khí thải carbon',   collocations: ['reduce carbon emissions', 'carbon emissions target'],      example: 'Transport is one of the largest sources of carbon emissions.' },
      { word: 'sustainable',       definition: 'Able to continue without damaging the environment or depleting resources', vietnamese: 'bền vững',         collocations: ['sustainable development', 'sustainable lifestyle'],        example: 'Sustainable agriculture protects the land for future generations.' },
      { word: 'recycle',           definition: 'To process used materials so they can be used again',                   vietnamese: 'tái chế',           collocations: ['recycle waste', 'recycling programme'],                    example: 'Recycling paper reduces the demand for new timber.' },
      { word: 'climate change',    definition: 'Long-term shifts in global temperatures and weather patterns',          vietnamese: 'biến đổi khí hậu', collocations: ['combat climate change', 'effects of climate change'],       example: 'Climate change is causing more frequent extreme weather events.' },
      { word: 'wildlife',          definition: 'Wild animals and plants living in their natural habitat',               vietnamese: 'động thực vật hoang dã', collocations: ['protect wildlife', 'wildlife habitat'],               example: 'Deforestation destroys critical wildlife habitats.' },
      { word: 'habitat',           definition: 'The natural environment where a plant or animal species lives',         vietnamese: 'môi trường sống',  collocations: ['natural habitat', 'destroy habitats'],                     example: 'Rising sea levels threaten the habitat of coastal species.' },
      { word: 'fossil fuels',      definition: 'Fuels formed from ancient organisms, such as coal, oil, and gas',      vietnamese: 'nhiên liệu hóa thạch', collocations: ['burn fossil fuels', 'dependence on fossil fuels'],      example: 'Burning fossil fuels is the primary driver of global warming.' },
      { word: 'conservation',      definition: 'The protection and preservation of natural environments and species',   vietnamese: 'bảo tồn thiên nhiên', collocations: ['wildlife conservation', 'conservation efforts'],         example: 'Conservation efforts have helped save several endangered species.' },
      { word: 'waste',             definition: 'Unwanted or unusable materials that must be disposed of',               vietnamese: 'rác thải',          collocations: ['reduce waste', 'plastic waste'],                           example: 'Reducing plastic waste is a key environmental priority.' },
      { word: 'deforestation',     definition: 'The clearing of large areas of forest for farming or development',     vietnamese: 'phá rừng',          collocations: ['rapid deforestation', 'combat deforestation'],             example: 'Deforestation contributes significantly to climate change.' },
    ],
    B2: [
      { word: 'biodiversity',      definition: 'The variety of plant and animal life in a particular habitat',         vietnamese: 'đa dạng sinh học',  collocations: ['protect biodiversity', 'loss of biodiversity'],            example: 'Rainforests support extraordinary levels of biodiversity.' },
      { word: 'ecological footprint', definition: 'The amount of land and water needed to support a person\'s lifestyle', vietnamese: 'dấu chân sinh thái', collocations: ['reduce ecological footprint', 'calculate ecological footprint'], example: 'Citizens in wealthy nations have a much larger ecological footprint.' },
      { word: 'contamination',     definition: 'The presence of harmful substances that make something impure',        vietnamese: 'ô nhiễm, làm bẩn', collocations: ['water contamination', 'soil contamination'],               example: 'Industrial runoff caused severe contamination of the local river.' },
      { word: 'greenhouse gas',    definition: 'A gas such as CO2 that traps heat in the Earth\'s atmosphere',        vietnamese: 'khí nhà kính',      collocations: ['reduce greenhouse gases', 'greenhouse gas emissions'],     example: 'Carbon dioxide is the most significant greenhouse gas.' },
      { word: 'ecosystem',         definition: 'A community of living organisms interacting with their environment',   vietnamese: 'hệ sinh thái',      collocations: ['fragile ecosystem', 'damage the ecosystem'],               example: 'Coral reefs are among the most fragile ecosystems on Earth.' },
      { word: 'carbon offset',     definition: 'A reduction in emissions to compensate for emissions elsewhere',       vietnamese: 'bù đắp carbon',     collocations: ['carbon offset scheme', 'purchase carbon offsets'],         example: 'Airlines offer carbon offset schemes for frequent flyers.' },
      { word: 'environmental legislation', definition: 'Laws designed to protect the natural environment',            vietnamese: 'luật môi trường',   collocations: ['strengthen environmental legislation', 'enforce legislation'], example: 'Stronger environmental legislation is needed to protect rivers.' },
      { word: 'drought',           definition: 'A prolonged period of abnormally low rainfall causing water shortage', vietnamese: 'hạn hán',           collocations: ['severe drought', 'drought conditions'],                    example: 'Prolonged drought devastated crops across the region.' },
      { word: 'landfill',          definition: 'A site where waste is buried in layers under the ground',              vietnamese: 'bãi rác',           collocations: ['reduce landfill waste', 'send to landfill'],               example: 'Millions of tonnes of plastic end up in landfill each year.' },
      { word: 'biodegradable',     definition: 'Capable of being broken down by bacteria or other living organisms',   vietnamese: 'phân hủy sinh học', collocations: ['biodegradable packaging', 'biodegradable material'],       example: 'Switching to biodegradable packaging reduces plastic waste.' },
      { word: 'overpopulation',    definition: 'A situation where the number of people exceeds the carrying capacity of an area', vietnamese: 'dân số quá tải', collocations: ['urban overpopulation', 'effects of overpopulation'],    example: 'Overpopulation puts enormous pressure on natural resources.' },
      { word: 'depletion',         definition: 'A reduction in the amount of a natural resource',                       vietnamese: 'sự cạn kiệt',       collocations: ['resource depletion', 'ozone depletion'],                   example: 'The depletion of fish stocks threatens food security.' },
    ],
    C1: [
      { word: 'carbon sequestration', definition: 'The process of capturing and storing atmospheric carbon dioxide',   vietnamese: 'cô lập carbon',     collocations: ['forest carbon sequestration', 'carbon sequestration technology'], example: 'Forest carbon sequestration is a natural way to offset emissions.' },
      { word: 'anthropogenic',     definition: 'Caused or produced by human activity rather than natural processes',   vietnamese: 'do con người gây ra', collocations: ['anthropogenic climate change', 'anthropogenic factors'],  example: 'Scientific consensus confirms that warming is primarily anthropogenic.' },
      { word: 'mitigation',        definition: 'Action taken to reduce the severity or impact of climate change',      vietnamese: 'giảm thiểu tác hại', collocations: ['climate change mitigation', 'mitigation strategy'],        example: 'Mitigation strategies include transitioning to low-carbon energy.' },
      { word: 'reforestation',     definition: 'The process of replanting trees in areas where forests have been cleared', vietnamese: 'tái trồng rừng',  collocations: ['large-scale reforestation', 'reforestation programme'],    example: 'Reforestation programmes restore biodiversity and absorb carbon.' },
      { word: 'desertification',   definition: 'The process by which fertile land gradually becomes desert',           vietnamese: 'sa mạc hóa',        collocations: ['prevent desertification', 'risk of desertification'],      example: 'Overgrazing accelerates desertification in semi-arid regions.' },
      { word: 'resilience',        definition: 'The ability of an ecosystem to recover from disruption or damage',     vietnamese: 'khả năng phục hồi', collocations: ['ecological resilience', 'build environmental resilience'],  example: 'Protecting biodiversity enhances the resilience of ecosystems.' },
      { word: 'geothermal energy', definition: 'Energy harnessed from heat generated within the Earth',                vietnamese: 'địa nhiệt',         collocations: ['geothermal energy plant', 'harness geothermal energy'],    example: 'Iceland generates most of its electricity from geothermal energy.' },
      { word: 'ecocide',           definition: 'Widespread destruction of ecosystems by human activity',               vietnamese: 'tàn phá hệ sinh thái', collocations: ['prevent ecocide', 'prosecute ecocide'],                  example: 'Environmental campaigners are pushing for ecocide to be recognised as a crime.' },
      { word: 'ocean acidification', definition: 'A decrease in the pH of the ocean due to absorption of CO2',        vietnamese: 'axit hóa đại dương', collocations: ['ocean acidification crisis', 'effects of ocean acidification'], example: 'Ocean acidification threatens the survival of coral reefs worldwide.' },
      { word: 'biodiversity hotspot', definition: 'A region with significant levels of biodiversity under threat',    vietnamese: 'điểm nóng đa dạng sinh học', collocations: ['protect biodiversity hotspot', 'global biodiversity hotspot'], example: 'The Amazon is one of the world\'s most critical biodiversity hotspots.' },
      { word: 'rewilding',         definition: 'Restoring an area to its natural uncultivated state',                   vietnamese: 'phục hồi thiên nhiên hoang dã', collocations: ['rewilding project', 'large-scale rewilding'],        example: 'Rewilding initiatives aim to reintroduce native species to degraded land.' },
      { word: 'circular economy',  definition: 'An economic system aimed at eliminating waste by reusing resources',   vietnamese: 'kinh tế tuần hoàn', collocations: ['transition to circular economy', 'circular economy model'], example: 'A circular economy reduces reliance on finite natural resources.' },
    ],
    C2: [
      { word: 'anthropocene',      definition: 'The current geological epoch defined by significant human impact on Earth', vietnamese: 'kỷ Nhân Sinh',    collocations: ['living in the Anthropocene', 'Anthropocene era'],          example: 'Geologists debate whether the Anthropocene represents a distinct epoch.' },
      { word: 'tipping point',     definition: 'A critical threshold beyond which a system undergoes an irreversible change', vietnamese: 'điểm tới hạn',   collocations: ['climate tipping point', 'reach a tipping point'],          example: 'Scientists warn that Arctic ice loss may trigger catastrophic tipping points.' },
      { word: 'geoengineering',    definition: 'Large-scale technological intervention to counteract climate change',   vietnamese: 'kỹ thuật địa cầu', collocations: ['solar geoengineering', 'climate geoengineering'],           example: 'Geoengineering proposals such as solar radiation management remain highly controversial.' },
      { word: 'planetary boundaries', definition: 'The safe operating limits within which humanity can develop sustainably', vietnamese: 'giới hạn hành tinh', collocations: ['exceed planetary boundaries', 'stay within planetary boundaries'], example: 'Several planetary boundaries have already been breached by human activity.' },
      { word: 'intergenerational equity', definition: 'The principle that current generations have a duty to preserve resources for future ones', vietnamese: 'công bằng giữa các thế hệ', collocations: ['principle of intergenerational equity', 'intergenerational equity in climate policy'], example: 'Intergenerational equity demands that we leave a habitable planet for our children.' },
      { word: 'bioaccumulation',   definition: 'The gradual build-up of toxic substances in living organisms through the food chain', vietnamese: 'tích lũy sinh học', collocations: ['bioaccumulation of toxins', 'bioaccumulation in marine life'], example: 'Mercury bioaccumulation in fish poses health risks to humans.' },
      { word: 'ecofeminism',       definition: 'A political theory linking the exploitation of nature to the oppression of women', vietnamese: 'chủ nghĩa sinh thái nữ quyền', collocations: ['ecofeminist theory', 'ecofeminism and activism'],    example: 'Ecofeminism highlights how environmental destruction disproportionately affects marginalised communities.' },
      { word: 'radiative forcing',  definition: 'The change in energy entering or leaving the Earth\'s atmosphere due to a climate factor', vietnamese: 'cưỡng bức bức xạ', collocations: ['positive radiative forcing', 'radiative forcing of CO2'], example: 'CO2 has a strong positive radiative forcing effect, trapping heat in the atmosphere.' },
    ],
  },
  'Education': {
    B1: [
      { word: 'academic achievement', definition: 'Success in studies, typically measured by grades or test scores',  vietnamese: 'thành tích học tập', collocations: ['improve academic achievement', 'academic achievement gap'],  example: 'Parental support plays a key role in academic achievement.' },
      { word: 'critical thinking',  definition: 'The ability to analyse and evaluate information objectively',        vietnamese: 'tư duy phản biện',  collocations: ['develop critical thinking', 'critical thinking skills'],   example: 'Critical thinking skills are essential for success in higher education.' },
      { word: 'curriculum',         definition: 'The subjects and content taught in a school or educational programme', vietnamese: 'chương trình học',  collocations: ['school curriculum', 'update the curriculum'],              example: 'The curriculum should include both academic and vocational subjects.' },
      { word: 'lifelong learning',  definition: 'The ongoing and voluntary pursuit of knowledge throughout life',     vietnamese: 'học suốt đời',      collocations: ['promote lifelong learning', 'culture of lifelong learning'], example: 'Lifelong learning helps workers adapt to rapidly changing industries.' },
      { word: 'compulsory education', definition: 'Education that the law requires children to receive up to a certain age', vietnamese: 'giáo dục bắt buộc', collocations: ['compulsory education age', 'extend compulsory education'],  example: 'Most countries provide free compulsory education up to the age of sixteen.' },
      { word: 'grade',              definition: 'A mark given to assess a student\'s work or performance',            vietnamese: 'điểm số',           collocations: ['improve grades', 'grade point average'],                   example: 'Students are under enormous pressure to achieve high grades.' },
      { word: 'teacher',            definition: 'A person who instructs students in a school or educational setting',  vietnamese: 'giáo viên',         collocations: ['qualified teacher', 'teacher shortage'],                   example: 'Teacher shortages are affecting the quality of education in rural areas.' },
      { word: 'motivation',         definition: 'The desire or willingness to do something',                           vietnamese: 'động lực',          collocations: ['student motivation', 'lack of motivation'],                example: 'Encouraging student motivation is a key challenge for teachers.' },
      { word: 'exam',               definition: 'A formal test of knowledge or ability',                               vietnamese: 'kỳ thi',            collocations: ['pass an exam', 'exam pressure'],                           example: 'Excessive exam pressure can harm students\' mental health.' },
      { word: 'knowledge',          definition: 'Information or understanding gained through experience or study',     vietnamese: 'kiến thức',         collocations: ['acquire knowledge', 'knowledge gap'],                      example: 'Education should focus on building knowledge and practical skills equally.' },
      { word: 'school',             definition: 'An institution where children receive formal education',               vietnamese: 'trường học',        collocations: ['primary school', 'school funding'],                        example: 'Well-funded schools produce better educational outcomes.' },
      { word: 'skill',              definition: 'A learned ability to do something well',                               vietnamese: 'kỹ năng',           collocations: ['develop skills', 'vocational skills'],                     example: 'Education systems should focus more on developing practical skills.' },
    ],
    B2: [
      { word: 'vocational training', definition: 'Education that prepares people for a specific trade or occupation', vietnamese: 'đào tạo nghề',      collocations: ['vocational training programme', 'expand vocational training'], example: 'Vocational training is often overlooked in favour of academic qualifications.' },
      { word: 'standardised testing', definition: 'Uniform exams used to assess all students in the same way',       vietnamese: 'kiểm tra chuẩn hóa', collocations: ['standardised testing system', 'rely on standardised tests'], example: 'Critics argue that standardised testing does not capture students\' full potential.' },
      { word: 'rote memorisation',  definition: 'Learning by repetition without necessarily understanding',           vietnamese: 'học thuộc lòng',    collocations: ['rote memorisation approach', 'rely on rote learning'],     example: 'Rote memorisation may help students pass exams but hinders deep understanding.' },
      { word: 'educational attainment', definition: 'The highest level of education a person has completed',         vietnamese: 'trình độ học vấn',  collocations: ['level of educational attainment', 'improve educational attainment'], example: 'Educational attainment is strongly linked to lifetime earnings.' },
      { word: 'academic pressure',  definition: 'The stress students feel to perform well in their studies',          vietnamese: 'áp lực học tập',    collocations: ['reduce academic pressure', 'intense academic pressure'],   example: 'Intense academic pressure can contribute to student mental health issues.' },
      { word: 'higher education',   definition: 'Education at the university or college level',                        vietnamese: 'giáo dục đại học',  collocations: ['access to higher education', 'higher education system'],   example: 'Access to higher education should not depend on family wealth.' },
      { word: 'tuition fee',        definition: 'Money charged by an educational institution for teaching',            vietnamese: 'học phí',           collocations: ['increase tuition fees', 'tuition fee debt'],               example: 'Rising tuition fees are deterring students from low-income families.' },
      { word: 'distance learning',  definition: 'A method of studying in which lessons take place remotely, often online', vietnamese: 'học từ xa',       collocations: ['distance learning platform', 'shift to distance learning'], example: 'Distance learning has expanded access to education in remote regions.' },
      { word: 'inclusive education', definition: 'An approach that accommodates all students regardless of ability', vietnamese: 'giáo dục hòa nhập', collocations: ['promote inclusive education', 'inclusive education policy'], example: 'Inclusive education ensures that students with disabilities are not marginalised.' },
      { word: 'dropout rate',       definition: 'The proportion of students who leave education without completing their studies', vietnamese: 'tỷ lệ bỏ học', collocations: ['reduce dropout rate', 'high dropout rate'],             example: 'Poverty is a major factor contributing to high dropout rates.' },
      { word: 'critical analysis',  definition: 'The process of examining information in detail to form a judgement', vietnamese: 'phân tích phê bình', collocations: ['develop critical analysis', 'apply critical analysis'],   example: 'University students must develop the ability to conduct critical analysis.' },
      { word: 'digital literacy',   definition: 'The ability to use digital tools and evaluate online information',    vietnamese: 'hiểu biết kỹ thuật số', collocations: ['improve digital literacy', 'digital literacy gap'],      example: 'Digital literacy is now considered as important as reading and writing.' },
    ],
    C1: [
      { word: 'socioeconomic inequality', definition: 'Unequal distribution of wealth and opportunity across different social groups', vietnamese: 'bất bình đẳng kinh tế xã hội', collocations: ['address socioeconomic inequality', 'reduce socioeconomic inequality'], example: 'Socioeconomic inequality is one of the greatest barriers to educational access.' },
      { word: 'social mobility',    definition: 'The ability to move between different social and economic levels',    vietnamese: 'dịch chuyển xã hội', collocations: ['promote social mobility', 'education as social mobility'],  example: 'Quality education is considered the most reliable pathway to social mobility.' },
      { word: 'pedagogy',           definition: 'The theory and practice of teaching and learning',                    vietnamese: 'phương pháp sư phạm', collocations: ['innovative pedagogy', 'student-centred pedagogy'],        example: 'Progressive pedagogy encourages collaborative rather than passive learning.' },
      { word: 'meritocracy',        definition: 'A system where advancement is based on ability and achievement',     vietnamese: 'chế độ nhân tài',   collocations: ['meritocratic ideal', 'true meritocracy'],                  example: 'Critics argue that the education system rewards privilege rather than merit.' },
      { word: 'academic rigour',    definition: 'High standards of intellectual challenge and thoroughness in learning', vietnamese: 'sự nghiêm khắc học thuật', collocations: ['maintain academic rigour', 'lack of academic rigour'], example: 'Technology-based learning must maintain academic rigour to be effective.' },
      { word: 'grade inflation',    definition: 'The tendency for grades to rise over time without reflecting improved performance', vietnamese: 'lạm phát điểm số', collocations: ['problem of grade inflation', 'address grade inflation'],   example: 'Grade inflation undermines the value of academic qualifications.' },
      { word: 'hidden curriculum',  definition: 'The implicit social norms and values taught through schooling beyond the official curriculum', vietnamese: 'chương trình ngầm', collocations: ['hidden curriculum effect', 'recognise hidden curriculum'], example: 'The hidden curriculum often reinforces existing social hierarchies.' },
      { word: 'constructivism',     definition: 'A learning theory holding that students construct knowledge through experience', vietnamese: 'chủ nghĩa kiến tạo', collocations: ['constructivist approach', 'social constructivism'],      example: 'Constructivism underpins project-based and inquiry-led learning.' },
      { word: 'attainment gap',     definition: 'The difference in academic performance between different groups of students', vietnamese: 'khoảng cách thành tích', collocations: ['close the attainment gap', 'racial attainment gap'],  example: 'The attainment gap between wealthy and disadvantaged pupils must be addressed.' },
      { word: 'learned helplessness', definition: 'A condition where students believe their efforts cannot change outcomes', vietnamese: 'sự bất lực có điều kiện', collocations: ['overcome learned helplessness', 'learned helplessness in school'], example: 'Constant failure without support can lead to learned helplessness.' },
      { word: 'formative assessment', definition: 'Ongoing assessment designed to monitor learning and provide feedback', vietnamese: 'đánh giá hình thành', collocations: ['formative assessment strategy', 'use formative assessment'], example: 'Formative assessment helps teachers identify gaps in student understanding.' },
      { word: 'STEM education',     definition: 'An approach emphasising science, technology, engineering, and mathematics', vietnamese: 'giáo dục STEM',     collocations: ['invest in STEM education', 'STEM education shortage'],     example: 'STEM education is seen as essential for preparing students for a digital economy.' },
    ],
    C2: [
      { word: 'credentialism',      definition: 'The excessive emphasis on qualifications and degrees over practical ability', vietnamese: 'chủ nghĩa bằng cấp', collocations: ['problem of credentialism', 'credentialism in hiring'],   example: 'Credentialism can exclude talented candidates who lack formal qualifications.' },
      { word: 'deschooling',        definition: 'The idea that institutional schooling should be replaced by informal learning', vietnamese: 'phi học đường hóa', collocations: ['deschooling society', 'deschooling movement'],            example: 'Ivan Illich\'s deschooling thesis challenged the role of compulsory schooling.' },
      { word: 'epistemic injustice', definition: 'The failure to take seriously the knowledge or testimony of marginalised groups', vietnamese: 'bất công nhận thức', collocations: ['epistemic injustice in education', 'address epistemic injustice'], example: 'Epistemic injustice occurs when minority students\' experiences are dismissed.' },
      { word: 'scholastic aptitude', definition: 'The innate or developed ability to perform academic tasks',               vietnamese: 'năng khiếu học thuật', collocations: ['assess scholastic aptitude', 'scholastic aptitude test'], example: 'Measuring scholastic aptitude fairly across socioeconomic groups remains a challenge.' },
      { word: 'knowledge economy',  definition: 'An economy based on the production and use of knowledge and information', vietnamese: 'kinh tế tri thức', collocations: ['transition to knowledge economy', 'knowledge economy skills'],  example: 'Education reform is essential to equip workers for a knowledge economy.' },
      { word: 'reflexive learning',  definition: 'Learning that requires students to reflect critically on their own assumptions', vietnamese: 'học phản tư',      collocations: ['reflexive learning process', 'promote reflexive learning'], example: 'Reflexive learning develops self-awareness alongside academic knowledge.' },
      { word: 'educational apartheid', definition: 'A system in which access to quality education is divided along racial or class lines', vietnamese: 'phân biệt đối xử trong giáo dục', collocations: ['challenge educational apartheid', 'end educational apartheid'], example: 'Educational apartheid persists when elite schools concentrate resources away from the poor.' },
      { word: 'cognitive load',     definition: 'The amount of mental effort being used in working memory during learning', vietnamese: 'tải nhận thức',    collocations: ['reduce cognitive load', 'cognitive load theory'],          example: 'Effective instructional design minimises unnecessary cognitive load.' },
    ],
  },
  'Health': {
    B1: [
      { word: 'obesity',            definition: 'A medical condition where excess body fat poses health risks',        vietnamese: 'béo phì',           collocations: ['childhood obesity', 'tackle obesity'],                     example: 'Rising rates of childhood obesity are linked to poor diet and inactivity.' },
      { word: 'nutrition',          definition: 'The process of obtaining food necessary for health and growth',       vietnamese: 'dinh dưỡng',        collocations: ['healthy nutrition', 'poor nutrition'],                     example: 'Poor nutrition in early childhood can affect development.' },
      { word: 'exercise',           definition: 'Physical activity done to improve health and fitness',                vietnamese: 'tập thể dục',       collocations: ['regular exercise', 'lack of exercise'],                    example: 'Regular exercise reduces the risk of many chronic diseases.' },
      { word: 'diet',               definition: 'The kinds of food that a person or community habitually eats',        vietnamese: 'chế độ ăn uống',    collocations: ['balanced diet', 'unhealthy diet'],                         example: 'A balanced diet rich in vegetables helps prevent heart disease.' },
      { word: 'healthcare',         definition: 'The organised provision of medical care to individuals in society',  vietnamese: 'chăm sóc sức khỏe', collocations: ['healthcare system', 'access to healthcare'],               example: 'Access to affordable healthcare is a basic right of all citizens.' },
      { word: 'vaccine',            definition: 'A substance used to stimulate immunity against a disease',            vietnamese: 'vắc-xin',           collocations: ['vaccine rollout', 'vaccine hesitancy'],                    example: 'Vaccine hesitancy poses a serious public health challenge.' },
      { word: 'mental health',      definition: 'A person\'s emotional, psychological, and social well-being',        vietnamese: 'sức khỏe tâm thần', collocations: ['mental health support', 'poor mental health'],             example: 'Schools should provide better mental health support for students.' },
      { word: 'prevention',         definition: 'Action taken to stop something harmful from happening',               vietnamese: 'phòng ngừa',        collocations: ['disease prevention', 'prevention strategy'],               example: 'Prevention is more cost-effective than treatment in healthcare.' },
      { word: 'hygiene',            definition: 'Practices that maintain cleanliness to prevent disease',               vietnamese: 'vệ sinh',           collocations: ['good hygiene', 'personal hygiene'],                        example: 'Good hygiene practices significantly reduce the spread of infection.' },
      { word: 'sedentary',          definition: 'Tending to spend much time seated or physically inactive',            vietnamese: 'ít vận động',       collocations: ['sedentary lifestyle', 'sedentary behaviour'],              example: 'A sedentary lifestyle increases the risk of heart disease and diabetes.' },
      { word: 'disease',            definition: 'A disorder or illness that affects the body or mind',                 vietnamese: 'bệnh tật',          collocations: ['infectious disease', 'chronic disease'],                   example: 'Infectious diseases spread rapidly in densely populated areas.' },
      { word: 'treatment',          definition: 'Medical care provided to cure or manage an illness',                  vietnamese: 'điều trị',          collocations: ['medical treatment', 'treatment options'],                  example: 'Early treatment significantly improves survival rates for many cancers.' },
    ],
    B2: [
      { word: 'chronic disease',    definition: 'A long-lasting health condition that requires ongoing management',    vietnamese: 'bệnh mãn tính',     collocations: ['manage chronic disease', 'chronic disease prevalence'],    example: 'Chronic diseases such as diabetes are placing immense pressure on health systems.' },
      { word: 'life expectancy',    definition: 'The average number of years a person is expected to live',            vietnamese: 'tuổi thọ',          collocations: ['increase life expectancy', 'gap in life expectancy'],      example: 'Life expectancy varies dramatically between rich and poor countries.' },
      { word: 'epidemic',           definition: 'A widespread occurrence of an infectious disease in a community',    vietnamese: 'dịch bệnh',         collocations: ['epidemic outbreak', 'declare an epidemic'],                example: 'Obesity has been described as a global epidemic.' },
      { word: 'pharmaceutical',     definition: 'Relating to medicinal drugs; a company producing them',               vietnamese: 'dược phẩm',         collocations: ['pharmaceutical industry', 'pharmaceutical drug'],           example: 'Pharmaceutical companies invest billions in developing new drugs.' },
      { word: 'accessible',         definition: 'Able to be reached or used by everyone, including disadvantaged groups', vietnamese: 'dễ tiếp cận',     collocations: ['accessible healthcare', 'make treatment accessible'],      example: 'Healthcare must be accessible regardless of income level.' },
      { word: 'mortality rate',     definition: 'The number of deaths in a particular population in a given time',    vietnamese: 'tỷ lệ tử vong',    collocations: ['reduce mortality rate', 'infant mortality rate'],           example: 'Improved sanitation has dramatically reduced infant mortality rates.' },
      { word: 'preventive healthcare', definition: 'Measures taken to prevent illness rather than treating it',       vietnamese: 'chăm sóc sức khỏe phòng ngừa', collocations: ['invest in preventive healthcare', 'preventive healthcare system'], example: 'Investment in preventive healthcare reduces long-term costs for governments.' },
      { word: 'cardiovascular',     definition: 'Relating to the heart and blood vessels',                             vietnamese: 'tim mạch',          collocations: ['cardiovascular disease', 'cardiovascular health'],         example: 'Smoking is a major risk factor for cardiovascular disease.' },
      { word: 'wellbeing',          definition: 'The state of being comfortable, healthy, and happy',                  vietnamese: 'sự khỏe mạnh, hạnh phúc', collocations: ['promote wellbeing', 'mental and physical wellbeing'],  example: 'Employers have a responsibility to promote the wellbeing of their staff.' },
      { word: 'addiction',          definition: 'The state of being unable to stop using a substance or behaviour',    vietnamese: 'nghiện',            collocations: ['drug addiction', 'treat addiction'],                        example: 'Social media addiction is an emerging public health concern.' },
      { word: 'sanitation',         definition: 'Conditions relating to safe waste disposal and clean water supply',   vietnamese: 'vệ sinh môi trường', collocations: ['poor sanitation', 'improve sanitation'],                   example: 'Poor sanitation is a leading cause of preventable deaths in developing countries.' },
      { word: 'malnutrition',       definition: 'A condition caused by an inadequate or unbalanced diet',              vietnamese: 'suy dinh dưỡng',    collocations: ['child malnutrition', 'address malnutrition'],              example: 'Malnutrition affects millions of children in the developing world.' },
    ],
    C1: [
      { word: 'health equity',      definition: 'The attainment of the highest level of health for all people regardless of background', vietnamese: 'công bằng y tế',   collocations: ['achieve health equity', 'health equity gap'],              example: 'Health equity remains a distant goal in countries with inadequate public systems.' },
      { word: 'social determinants of health', definition: 'Non-medical factors such as income and education that influence health outcomes', vietnamese: 'các yếu tố xã hội quyết định sức khỏe', collocations: ['address social determinants', 'social determinants of health framework'], example: 'Addressing the social determinants of health requires cross-sector collaboration.' },
      { word: 'austerity measures',  definition: 'Government policies cutting public spending, often affecting health services', vietnamese: 'biện pháp thắt lưng buộc bụng', collocations: ['health impact of austerity', 'austerity measures in healthcare'], example: 'Austerity measures have led to staff shortages and longer waiting times in hospitals.' },
      { word: 'epidemiology',       definition: 'The study of how diseases spread and can be controlled in populations', vietnamese: 'dịch tễ học',       collocations: ['epidemiology study', 'epidemiological data'],              example: 'Epidemiology data guided the public health response to the pandemic.' },
      { word: 'immunisation',       definition: 'The process of making a person immune to a disease, typically through vaccination', vietnamese: 'tiêm chủng',       collocations: ['mass immunisation', 'immunisation programme'],              example: 'Mass immunisation programmes have eradicated several deadly diseases.' },
      { word: 'comorbidity',        definition: 'The presence of two or more medical conditions in the same person',    vietnamese: 'bệnh đồng mắc',    collocations: ['comorbidity risk', 'manage comorbidity'],                  example: 'Patients with comorbidities are at higher risk of complications from infections.' },
      { word: 'health literacy',    definition: 'The ability to understand and use health information to make decisions', vietnamese: 'hiểu biết về sức khỏe', collocations: ['improve health literacy', 'low health literacy'],        example: 'Low health literacy is associated with poorer health outcomes and higher costs.' },
      { word: 'palliative care',    definition: 'Medical care focused on providing relief from pain and symptoms of illness', vietnamese: 'chăm sóc giảm nhẹ', collocations: ['palliative care provision', 'expand palliative care'],    example: 'Palliative care improves quality of life for patients with terminal illness.' },
      { word: 'iatrogenic',         definition: 'Harm or illness caused inadvertently by medical treatment',             vietnamese: 'tai biến do y tế',  collocations: ['iatrogenic harm', 'iatrogenic disease'],                   example: 'Overprescription of antibiotics can cause iatrogenic problems including resistance.' },
      { word: 'pandemic preparedness', definition: 'A country\'s ability to respond effectively to a global disease outbreak', vietnamese: 'sẵn sàng ứng phó đại dịch', collocations: ['improve pandemic preparedness', 'pandemic preparedness plan'], example: 'COVID-19 exposed critical gaps in pandemic preparedness worldwide.' },
    ],
    C2: [
      { word: 'medicalisation',     definition: 'The process of defining normal human behaviours as medical conditions requiring treatment', vietnamese: 'y học hóa', collocations: ['medicalisation of mental health', 'critique of medicalisation'], example: 'Critics argue that the medicalisation of anxiety pathologises ordinary human experience.' },
      { word: 'health sovereignty',  definition: 'A community\'s right to determine its own health policies independent of external powers', vietnamese: 'chủ quyền y tế', collocations: ['health sovereignty movement', 'protect health sovereignty'], example: 'Health sovereignty debates intensified during the COVID-19 vaccine distribution process.' },
      { word: 'iatrarchy',          definition: 'The dominance of medical professionals in public health decision-making', vietnamese: 'sự thống trị của giới y khoa', collocations: ['challenge iatrarchy', 'medical iatrarchy'],           example: 'Public health scholars debate whether iatrarchy undermines community-led approaches.' },
      { word: 'biopolitics',        definition: 'The application of political power over biological life and the human body', vietnamese: 'chính trị sinh học', collocations: ['Foucauldian biopolitics', 'biopolitics of healthcare'],  example: 'Biopolitics examines how governments regulate bodies through vaccination mandates.' },
      { word: 'pharmacological revolution', definition: 'The transformative development of new drugs in the 20th century', vietnamese: 'cách mạng dược phẩm', collocations: ['impact of pharmacological revolution', 'post-pharmacological era'], example: 'The pharmacological revolution dramatically extended human life expectancy.' },
      { word: 'syndemic',           definition: 'Two or more epidemics interacting with each other and with social conditions', vietnamese: 'hiện tượng dịch bệnh cộng hưởng', collocations: ['COVID syndemic', 'address syndemic conditions'],      example: 'The syndemic of obesity, poverty, and COVID-19 overwhelmed health systems in some regions.' },
    ],
  },
  'Society': {
    B1: [
      { word: 'community',          definition: 'A group of people living in the same area or sharing common interests', vietnamese: 'cộng đồng',         collocations: ['local community', 'community spirit'],                     example: 'A strong sense of community helps people support each other.' },
      { word: 'equality',           definition: 'The state of being equal in rights, status, and opportunities',        vietnamese: 'bình đẳng',         collocations: ['gender equality', 'racial equality'],                      example: 'Gender equality in the workplace remains an unfinished goal.' },
      { word: 'culture',            definition: 'The customs, beliefs, arts, and social behaviour of a group',          vietnamese: 'văn hóa',           collocations: ['cultural diversity', 'cultural heritage'],                 example: 'Cultural diversity enriches society and broadens people\'s perspectives.' },
      { word: 'tradition',          definition: 'A long-established custom or belief passed down through generations',   vietnamese: 'truyền thống',      collocations: ['preserve tradition', 'cultural tradition'],                example: 'Some traditions may need to evolve to reflect modern values.' },
      { word: 'discrimination',     definition: 'Treating people unfairly because of their race, gender, or other characteristics', vietnamese: 'phân biệt đối xử', collocations: ['racial discrimination', 'end discrimination'],          example: 'Racial discrimination remains a serious issue in many societies.' },
      { word: 'poverty',            definition: 'The state of being extremely poor with inadequate resources',           vietnamese: 'nghèo đói',         collocations: ['extreme poverty', 'reduce poverty'],                       example: 'Extreme poverty denies millions of people access to basic necessities.' },
      { word: 'volunteer',          definition: 'To freely offer to do something without being paid',                    vietnamese: 'tình nguyện',       collocations: ['volunteer work', 'volunteer organisation'],                example: 'Volunteer organisations play a crucial role in supporting vulnerable communities.' },
      { word: 'elderly',            definition: 'Old people, especially those requiring care',                           vietnamese: 'người cao tuổi',    collocations: ['elderly population', 'care for the elderly'],              example: 'Many societies face challenges in caring for an ageing elderly population.' },
      { word: 'media',              definition: 'Means of mass communication such as television, newspapers, and the internet', vietnamese: 'truyền thông', collocations: ['social media', 'media influence'],                        example: 'Social media has transformed how people consume news.' },
      { word: 'value',              definition: 'A principle or standard that guides behaviour in society',               vietnamese: 'giá trị',           collocations: ['social values', 'core values'],                            example: 'Education should instil core social values in young people.' },
      { word: 'family',             definition: 'A group of people related by blood, marriage, or shared upbringing',    vietnamese: 'gia đình',          collocations: ['family structure', 'family values'],                       example: 'Changing family structures reflect broader shifts in modern society.' },
      { word: 'society',            definition: 'The community of people living in an organised system',                  vietnamese: 'xã hội',            collocations: ['modern society', 'function in society'],                   example: 'Education prepares young people to function effectively in society.' },
    ],
    B2: [
      { word: 'social cohesion',    definition: 'The bonds that bring members of society together',                       vietnamese: 'sự gắn kết xã hội', collocations: ['promote social cohesion', 'strengthen social cohesion'],  example: 'Immigration policies must be designed to promote social cohesion.' },
      { word: 'urbanisation',       definition: 'The process by which more people move to and live in cities',            vietnamese: 'đô thị hóa',        collocations: ['rapid urbanisation', 'effects of urbanisation'],           example: 'Rapid urbanisation has created challenges including overcrowding and pollution.' },
      { word: 'social mobility',    definition: 'The ability of individuals to move between different social and economic levels', vietnamese: 'dịch chuyển xã hội', collocations: ['upward social mobility', 'promote social mobility'],   example: 'Education is widely regarded as the key driver of social mobility.' },
      { word: 'marginalised',       definition: 'Treated as insignificant or excluded from society',                      vietnamese: 'bị gạt ra ngoài lề', collocations: ['marginalised community', 'support marginalised groups'],  example: 'Policies must specifically address the needs of marginalised communities.' },
      { word: 'welfare state',      definition: 'A system in which the government provides social protection for citizens', vietnamese: 'nhà nước phúc lợi', collocations: ['welfare state funding', 'shrink the welfare state'],      example: 'The welfare state ensures that citizens are protected from extreme poverty.' },
      { word: 'integration',        definition: 'The process of bringing different groups together within society',        vietnamese: 'hội nhập',          collocations: ['social integration', 'successful integration'],            example: 'Language skills are essential for the successful integration of migrants.' },
      { word: 'ageing population',  definition: 'A demographic trend where older people make up a growing share of society', vietnamese: 'dân số già hóa',   collocations: ['challenge of ageing population', 'ageing population crisis'], example: 'An ageing population puts increasing pressure on pension and health systems.' },
      { word: 'migration',          definition: 'The movement of people from one region or country to another',            vietnamese: 'di cư',             collocations: ['mass migration', 'economic migration'],                    example: 'Economic migration has contributed to labour shortages in many countries.' },
      { word: 'stereotype',         definition: 'A widely held but oversimplified image or idea of a particular type of person', vietnamese: 'định kiến rập khuôn', collocations: ['challenge stereotypes', 'reinforce stereotypes'],      example: 'Media portrayals often reinforce harmful stereotypes about minorities.' },
      { word: 'diversity',          definition: 'A range of different people or things in a group',                        vietnamese: 'sự đa dạng',        collocations: ['cultural diversity', 'embrace diversity'],                 example: 'Embracing diversity makes workplaces more creative and productive.' },
      { word: 'social norms',       definition: 'Shared expectations and rules that guide behaviour in a group',           vietnamese: 'chuẩn mực xã hội', collocations: ['challenge social norms', 'uphold social norms'],           example: 'Social norms around gender are slowly changing in many countries.' },
      { word: 'inequality',         definition: 'The unequal distribution of income, wealth, or opportunity in society',  vietnamese: 'bất bình đẳng',    collocations: ['reduce inequality', 'growing inequality'],                 example: 'Growing inequality threatens the social fabric of democratic societies.' },
    ],
    C1: [
      { word: 'demographic shift',  definition: 'A significant change in the size or composition of a population',       vietnamese: 'thay đổi cơ cấu dân số', collocations: ['demographic shift in society', 'major demographic shift'], example: 'Demographic shifts towards older populations will reshape labour markets.' },
      { word: 'systemic racism',    definition: 'Policies and practices embedded in institutions that disadvantage racial minorities', vietnamese: 'phân biệt chủng tộc hệ thống', collocations: ['address systemic racism', 'end systemic racism'],  example: 'Systemic racism in criminal justice leads to disproportionate imprisonment of minorities.' },
      { word: 'civic engagement',   definition: 'Active participation by citizens in the life and governance of their community', vietnamese: 'sự tham gia công dân', collocations: ['promote civic engagement', 'decline in civic engagement'], example: 'A decline in civic engagement threatens the health of democracy.' },
      { word: 'social stratification', definition: 'The hierarchical division of society into groups based on wealth, power, or prestige', vietnamese: 'phân tầng xã hội', collocations: ['social stratification system', 'challenge social stratification'], example: 'Social stratification limits life chances for those born into lower classes.' },
      { word: 'assimilation',       definition: 'The process by which a minority group adopts the culture of a dominant group', vietnamese: 'đồng hóa',         collocations: ['cultural assimilation', 'resist assimilation'],            example: 'Forced cultural assimilation can erode minority identities and traditions.' },
      { word: 'social capital',     definition: 'The networks and shared values that enable cooperation within society',   vietnamese: 'vốn xã hội',       collocations: ['build social capital', 'decline of social capital'],       example: 'High social capital communities recover more effectively from crises.' },
      { word: 'disenfranchisement', definition: 'The state of being deprived of a right, especially the right to vote',   vietnamese: 'bị tước quyền',    collocations: ['voter disenfranchisement', 'political disenfranchisement'], example: 'Disenfranchisement of prisoners raises questions about justice and rehabilitation.' },
      { word: 'atomisation',        definition: 'The breakdown of social bonds and community ties, leaving people isolated', vietnamese: 'sự phân rã xã hội', collocations: ['social atomisation', 'risk of atomisation'],              example: 'Digital technology may accelerate the atomisation of modern communities.' },
      { word: 'consumerism',        definition: 'A cultural tendency to equate personal happiness with buying goods',      vietnamese: 'chủ nghĩa tiêu dùng', collocations: ['mass consumerism', 'critique of consumerism'],           example: 'Rampant consumerism drives environmental degradation and social inequality.' },
      { word: 'empathy',            definition: 'The ability to understand and share the feelings of another person',      vietnamese: 'sự đồng cảm',      collocations: ['develop empathy', 'lack of empathy'],                      example: 'Social media use has been linked to declining levels of empathy among young people.' },
    ],
    C2: [
      { word: 'hegemony',           definition: 'Leadership or dominance of one group over others in political and cultural life', vietnamese: 'bá quyền',        collocations: ['cultural hegemony', 'challenge hegemony'],                example: 'Cultural hegemony shapes what values and beliefs are considered normal in society.' },
      { word: 'intersectionality',  definition: 'The way different aspects of identity interact to create overlapping forms of discrimination', vietnamese: 'giao thoa bản sắc', collocations: ['lens of intersectionality', 'apply intersectionality'],  example: 'Intersectionality shows that race and gender discrimination cannot be analysed in isolation.' },
      { word: 'postmodernism',      definition: 'A late 20th-century movement questioning grand narratives and objective truth', vietnamese: 'chủ nghĩa hậu hiện đại', collocations: ['postmodern society', 'postmodern critique'],          example: 'Postmodernism challenges the idea that science provides a single objective account of reality.' },
      { word: 'anomie',             definition: 'A social condition of instability caused by the breakdown of standards', vietnamese: 'sự vô chuẩn xã hội', collocations: ['state of anomie', 'Durkheim\'s anomie'],                example: 'Rapid economic change can produce anomie as people lose their sense of belonging.' },
      { word: 'spectacle society',  definition: 'Debord\'s concept of a society where authentic life is replaced by representation', vietnamese: 'xã hội của biểu diễn', collocations: ['spectacle society critique', 'living in a spectacle'], example: 'Social media influencer culture exemplifies what Debord called the spectacle society.' },
      { word: 'precariat',          definition: 'A social class suffering from precarious employment and lack of social protections', vietnamese: 'tầng lớp bấp bênh', collocations: ['growth of the precariat', 'precariat class'],           example: 'The gig economy has swelled the ranks of the global precariat.' },
      { word: 'social epistemology', definition: 'The study of how social factors influence the production and spread of knowledge', vietnamese: 'nhận thức luận xã hội', collocations: ['social epistemology research', 'apply social epistemology'], example: 'Social epistemology examines how misinformation spreads through social networks.' },
      { word: 'habitus',            definition: 'Bourdieu\'s concept of deeply ingrained habits and dispositions shaped by social position', vietnamese: 'thói quen xã hội (habitus)', collocations: ['Bourdieu\'s habitus', 'habitus and social class'], example: 'Habitus explains why people from different class backgrounds make different life choices.' },
    ],
  },
  'Work & Career': {
    B1: [
      { word: 'career',             definition: 'An occupation undertaken for a significant period of life with advancement', vietnamese: 'sự nghiệp',         collocations: ['career development', 'career path'],                      example: 'Many people now change career direction several times in their lives.' },
      { word: 'salary',             definition: 'A fixed regular payment made to an employee',                              vietnamese: 'lương',              collocations: ['minimum salary', 'raise a salary'],                       example: 'A living salary is the minimum workers need to meet basic needs.' },
      { word: 'teamwork',           definition: 'The combined effort of a group to achieve a common goal',                  vietnamese: 'làm việc nhóm',      collocations: ['effective teamwork', 'promote teamwork'],                 example: 'Effective teamwork is essential in most modern workplaces.' },
      { word: 'employer',           definition: 'A person or organisation that employs people',                              vietnamese: 'người sử dụng lao động', collocations: ['employer responsibilities', 'potential employer'],     example: 'Employers are legally obliged to provide safe working conditions.' },
      { word: 'productivity',       definition: 'The effectiveness of effort, measured in terms of work output',            vietnamese: 'năng suất',          collocations: ['increase productivity', 'worker productivity'],           example: 'Remote working arrangements can improve productivity for many employees.' },
      { word: 'interview',          definition: 'A formal meeting in which someone is assessed for a job',                  vietnamese: 'phỏng vấn',          collocations: ['job interview', 'interview skills'],                       example: 'Strong interview skills are as important as qualifications.' },
      { word: 'promotion',          definition: 'An advancement to a higher position in a job',                              vietnamese: 'thăng chức',         collocations: ['earn a promotion', 'promotion opportunities'],            example: 'Women still face barriers to promotion in many industries.' },
      { word: 'training',           definition: 'Teaching that provides practical skills for a job or role',                 vietnamese: 'đào tạo',            collocations: ['on-the-job training', 'provide training'],                example: 'Regular training keeps workers up to date with industry developments.' },
      { word: 'colleague',          definition: 'A person with whom one works',                                              vietnamese: 'đồng nghiệp',        collocations: ['work with colleagues', 'support colleagues'],             example: 'A positive relationship with colleagues improves job satisfaction.' },
      { word: 'deadline',           definition: 'A time limit by which work must be completed',                              vietnamese: 'hạn chót',           collocations: ['meet a deadline', 'tight deadline'],                      example: 'Meeting tight deadlines is a key requirement in most professional roles.' },
      { word: 'qualification',      definition: 'A skill or achievement that makes someone suitable for a job',              vietnamese: 'bằng cấp, năng lực', collocations: ['required qualification', 'professional qualification'],   example: 'Professional qualifications are increasingly important in competitive job markets.' },
      { word: 'unemployment',       definition: 'The state of not having a paid job',                                        vietnamese: 'thất nghiệp',        collocations: ['youth unemployment', 'reduce unemployment'],              example: 'Youth unemployment remains persistently high in many countries.' },
    ],
    B2: [
      { word: 'remote work',        definition: 'Working outside of a traditional office environment, often from home',     vietnamese: 'làm việc từ xa',     collocations: ['shift to remote work', 'remote work policy'],             example: 'The pandemic accelerated the shift to remote work globally.' },
      { word: 'work-life balance',  definition: 'The equilibrium between professional responsibilities and personal time',   vietnamese: 'cân bằng công việc - cuộc sống', collocations: ['achieve work-life balance', 'poor work-life balance'], example: 'Poor work-life balance is a leading cause of employee burnout.' },
      { word: 'gig economy',        definition: 'An economic system based on short-term contracts and freelance work',       vietnamese: 'kinh tế việc làm thời vụ', collocations: ['gig economy growth', 'gig economy worker'],         example: 'The gig economy offers flexibility but lacks job security.' },
      { word: 'burnout',            definition: 'A state of mental and physical exhaustion caused by excessive work',        vietnamese: 'kiệt sức do công việc', collocations: ['suffer burnout', 'prevent burnout'],                  example: 'High-pressure workplaces are seeing epidemic levels of burnout.' },
      { word: 'redundancy',         definition: 'The dismissal of an employee because their role is no longer needed',       vietnamese: 'bị cho thôi việc',   collocations: ['face redundancy', 'voluntary redundancy'],                example: 'Automation has led to widespread redundancies in manufacturing.' },
      { word: 'flexible working',   definition: 'A work arrangement that allows employees to vary hours or location',        vietnamese: 'làm việc linh hoạt', collocations: ['adopt flexible working', 'flexible working arrangement'],  example: 'Flexible working enables better work-life balance for parents.' },
      { word: 'upskill',            definition: 'To learn new skills or improve existing ones, often for career advancement', vietnamese: 'nâng cao kỹ năng',   collocations: ['upskill workers', 'need to upskill'],                     example: 'Workers must upskill regularly to remain relevant in a changing job market.' },
      { word: 'collaboration',      definition: 'Working jointly with others to achieve a goal',                              vietnamese: 'hợp tác',            collocations: ['cross-team collaboration', 'foster collaboration'],        example: 'Digital tools have made collaboration across time zones much easier.' },
      { word: 'labour market',      definition: 'The supply and demand for employment within an economy',                    vietnamese: 'thị trường lao động', collocations: ['competitive labour market', 'tight labour market'],       example: 'A tight labour market gives workers more bargaining power.' },
      { word: 'entrepreneurship',   definition: 'The activity of setting up businesses and taking financial risk',           vietnamese: 'tinh thần khởi nghiệp', collocations: ['promote entrepreneurship', 'entrepreneurship skills'],   example: 'Governments are promoting entrepreneurship as a driver of economic growth.' },
      { word: 'occupational hazard', definition: 'A risk or danger associated with a specific type of work',                 vietnamese: 'rủi ro nghề nghiệp', collocations: ['occupational hazard exposure', 'reduce occupational hazards'], example: 'Repetitive strain injuries are an occupational hazard for office workers.' },
      { word: 'glass ceiling',      definition: 'An invisible barrier that prevents women or minorities from advancing',     vietnamese: 'trần kính',          collocations: ['break the glass ceiling', 'glass ceiling effect'],        example: 'Women continue to face a glass ceiling in corporate leadership.' },
    ],
    C1: [
      { word: 'automation displacement', definition: 'The loss of jobs caused by machines or AI taking over tasks',       vietnamese: 'mất việc do tự động hóa', collocations: ['address automation displacement', 'automation displacement risk'], example: 'Governments must design safety nets to protect workers from automation displacement.' },
      { word: 'portfolio career',   definition: 'A career pattern involving multiple jobs or roles simultaneously',          vietnamese: 'sự nghiệp đa dạng',  collocations: ['build a portfolio career', 'portfolio career approach'],  example: 'A portfolio career allows individuals to diversify their skills and income.' },
      { word: 'precarious employment', definition: 'Work that is insecure, poorly paid, and lacking in social protection', vietnamese: 'việc làm bấp bênh',  collocations: ['rise of precarious employment', 'precarious employment conditions'], example: 'The growth of precarious employment threatens workers\' financial security.' },
      { word: 'vocational education', definition: 'Training that prepares people for skilled trades or occupations',        vietnamese: 'giáo dục hướng nghiệp', collocations: ['invest in vocational education', 'vocational education system'], example: 'Expanding vocational education can address critical skill shortages.' },
      { word: 'human capital',      definition: 'The economic value of an employee\'s knowledge, skills, and experience',   vietnamese: 'vốn nhân lực',       collocations: ['invest in human capital', 'human capital development'],   example: 'Nations that invest in human capital tend to achieve stronger economic growth.' },
      { word: 'meritocracy',        definition: 'A system in which advancement is based on individual ability and effort',  vietnamese: 'chế độ nhân tài',    collocations: ['meritocratic ideal', 'true meritocracy'],                  example: 'Critics argue the workplace is far from the meritocracy it claims to be.' },
      { word: 'wage stagnation',    definition: 'A period during which wages fail to grow in real terms',                   vietnamese: 'đình trệ tiền lương', collocations: ['address wage stagnation', 'decades of wage stagnation'],  example: 'Wage stagnation has led to rising inequality in many developed countries.' },
      { word: 'corporate culture',  definition: 'The shared values, beliefs, and practices within an organisation',         vietnamese: 'văn hóa doanh nghiệp', collocations: ['toxic corporate culture', 'shape corporate culture'],     example: 'A toxic corporate culture can drive high staff turnover and low morale.' },
      { word: 'outsourcing',        definition: 'The practice of having work done by people outside of the main organisation', vietnamese: 'thuê ngoài',        collocations: ['offshore outsourcing', 'outsourcing jobs'],               example: 'Outsourcing manufacturing to cheaper countries reduces domestic employment.' },
      { word: 'pay gap',            definition: 'The difference in average earnings between different groups of workers',    vietnamese: 'khoảng cách lương',  collocations: ['gender pay gap', 'close the pay gap'],                     example: 'Closing the gender pay gap requires both legal reform and cultural change.' },
    ],
    C2: [
      { word: 'labour commodification', definition: 'The process of treating human work purely as a commodity to be bought and sold', vietnamese: 'hàng hóa hóa lao động', collocations: ['labour commodification critique', 'resist labour commodification'], example: 'Labour commodification in the gig economy erodes workers\' dignity and rights.' },
      { word: 'Bullshit Jobs',      definition: 'David Graeber\'s term for jobs that are pointless and even those who do them know it', vietnamese: 'công việc vô nghĩa', collocations: ['proliferation of bullshit jobs', 'Graeber bullshit jobs theory'], example: 'Graeber argued that modern economies are filled with bullshit jobs that serve no real function.' },
      { word: 'post-work society',  definition: 'A vision of society where technology eliminates the need for most paid work', vietnamese: 'xã hội hậu lao động', collocations: ['move towards post-work society', 'post-work thesis'],   example: 'Universal basic income is proposed as a solution in a post-work society.' },
      { word: 'neoliberal work ethic', definition: 'The ideology that individual productivity and hard work are the measures of personal worth', vietnamese: 'đạo đức lao động tân tự do', collocations: ['challenge neoliberal work ethic', 'internalised neoliberal work ethic'], example: 'The neoliberal work ethic places all responsibility for economic success on the individual.' },
      { word: 'technological feudalism', definition: 'A socioeconomic system in which a few tech companies control vast wealth and labour', vietnamese: 'chế độ phong kiến kỹ thuật số', collocations: ['digital technological feudalism', 'rise of technological feudalism'], example: 'Critics of Big Tech describe a form of technological feudalism where platforms extract value from workers.' },
      { word: 'workplace surveillance', definition: 'Monitoring of employee activity, performance, and behaviour by employers', vietnamese: 'giám sát nơi làm việc', collocations: ['digital workplace surveillance', 'increase in workplace surveillance'], example: 'Workplace surveillance via software raises serious concerns about privacy and trust.' },
    ],
  },
  'Crime & Law': {
    B1: [
      { word: 'crime',              definition: 'An action that is against the law',                                        vietnamese: 'tội phạm',          collocations: ['commit a crime', 'crime rate'],                            example: 'Poverty and crime are closely linked in many urban areas.' },
      { word: 'punishment',         definition: 'A penalty imposed on a person for breaking the law',                       vietnamese: 'hình phạt',         collocations: ['harsh punishment', 'punishment for crime'],                example: 'Harsher punishment does not always deter criminal behaviour.' },
      { word: 'law',                definition: 'A system of rules enforced by a government or authority',                  vietnamese: 'luật pháp',         collocations: ['break the law', 'uphold the law'],                         example: 'All citizens have a responsibility to uphold the law.' },
      { word: 'justice',            definition: 'Fair treatment and due reward according to the law',                        vietnamese: 'công lý',           collocations: ['criminal justice', 'seek justice'],                        example: 'The criminal justice system must treat all defendants fairly.' },
      { word: 'prison',             definition: 'A place where people convicted of crimes are confined',                    vietnamese: 'nhà tù',            collocations: ['prison sentence', 'prison population'],                    example: 'Overcrowded prisons make rehabilitation extremely difficult.' },
      { word: 'victim',             definition: 'A person harmed or killed as a result of a crime',                         vietnamese: 'nạn nhân',          collocations: ['crime victim', 'support victims'],                         example: 'Society must do more to support victims of violent crime.' },
      { word: 'police',             definition: 'The civil force responsible for preventing and detecting crime',            vietnamese: 'cảnh sát',          collocations: ['police officer', 'police force'],                          example: 'Community policing builds trust between officers and residents.' },
      { word: 'compulsory',         definition: 'Required by law or rule; not optional',                                     vietnamese: 'bắt buộc',          collocations: ['compulsory service', 'compulsory education'],              example: 'Compulsory community service could be an alternative to prison for minor offences.' },
      { word: 'offence',            definition: 'An act that breaks a law or rule',                                          vietnamese: 'hành vi phạm tội',  collocations: ['criminal offence', 'minor offence'],                       example: 'Minor offences should be dealt with through community programmes rather than prison.' },
      { word: 'trial',              definition: 'A formal examination of evidence in a court of law',                        vietnamese: 'phiên tòa xét xử',  collocations: ['fair trial', 'criminal trial'],                            example: 'Every defendant has the right to a fair trial.' },
      { word: 'sentence',           definition: 'The punishment given to a person convicted of a crime',                    vietnamese: 'bản án',            collocations: ['prison sentence', 'reduced sentence'],                     example: 'Judges have discretion to consider individual circumstances when passing sentence.' },
      { word: 'evidence',           definition: 'Information used to establish facts in a legal proceeding',                 vietnamese: 'bằng chứng',        collocations: ['present evidence', 'lack of evidence'],                    example: 'Convictions must be based on clear and credible evidence.' },
    ],
    B2: [
      { word: 'deter',              definition: 'To discourage someone from committing a crime through fear of consequences', vietnamese: 'răn đe',            collocations: ['deter crime', 'deter criminals'],                          example: 'The threat of a long prison sentence is intended to deter potential offenders.' },
      { word: 'rehabilitate',       definition: 'To restore a criminal to a useful life through education and support',     vietnamese: 'cải tạo, phục hồi', collocations: ['rehabilitate offenders', 'rehabilitate prisoners'],         example: 'The prison system should focus more on rehabilitating offenders than punishing them.' },
      { word: 'legislation',        definition: 'Laws enacted by a government or legislature',                               vietnamese: 'luật pháp, lập pháp', collocations: ['enact legislation', 'tighten legislation'],               example: 'Tougher legislation against cybercrime is urgently needed.' },
      { word: 'surveillance',       definition: 'Close monitoring of people, especially by authorities',                    vietnamese: 'giám sát',          collocations: ['CCTV surveillance', 'mass surveillance'],                  example: 'CCTV surveillance in public spaces raises privacy concerns.' },
      { word: 'accountability',     definition: 'The obligation to accept responsibility for one\'s actions',               vietnamese: 'trách nhiệm giải trình', collocations: ['police accountability', 'hold accountable'],           example: 'Stronger accountability mechanisms are needed to prevent police misconduct.' },
      { word: 'enact',              definition: 'To make a bill or proposal into law',                                       vietnamese: 'ban hành luật',     collocations: ['enact legislation', 'enact reform'],                       example: 'Governments must enact tougher environmental laws to protect the climate.' },
      { word: 'proportionate',      definition: 'Appropriate in size or degree relative to something else',                 vietnamese: 'tương xứng',        collocations: ['proportionate response', 'proportionate sentence'],        example: 'Sentences should be proportionate to the seriousness of the offence.' },
      { word: 'infringe',           definition: 'To violate or limit a right or rule',                                       vietnamese: 'vi phạm, xâm phạm', collocations: ['infringe rights', 'infringe on privacy'],                  example: 'Surveillance laws must not infringe on citizens\' right to privacy.' },
      { word: 'corruption',         definition: 'Dishonest or illegal behaviour, especially by those in power',              vietnamese: 'tham nhũng',        collocations: ['government corruption', 'tackle corruption'],              example: 'Corruption in the justice system undermines public trust in the law.' },
      { word: 'acquit',             definition: 'To formally declare that someone is not guilty of a crime',                 vietnamese: 'tha bổng, tuyên vô tội', collocations: ['acquit a defendant', 'wrongly acquit'],                example: 'The jury acquitted the defendant due to insufficient evidence.' },
      { word: 'conviction',         definition: 'A formal declaration that someone is guilty of a criminal offence',        vietnamese: 'bản án kết tội',    collocations: ['wrongful conviction', 'secure a conviction'],              example: 'Wrongful convictions can destroy innocent people\'s lives.' },
      { word: 'bail',               definition: 'The temporary release of an accused person while awaiting trial',           vietnamese: 'bảo lãnh tại ngoại', collocations: ['deny bail', 'set bail conditions'],                       example: 'Bail conditions must balance individual liberty with public safety.' },
    ],
    C1: [
      { word: 'deterrence',         definition: 'The use of punishment or threat to discourage criminal behaviour',         vietnamese: 'sự răn đe',         collocations: ['deterrence theory', 'act as a deterrence'],               example: 'Deterrence theory argues that the certainty of punishment matters more than its severity.' },
      { word: 'recidivism',         definition: 'The tendency of a convicted criminal to reoffend',                          vietnamese: 'tái phạm tội',      collocations: ['reduce recidivism', 'high recidivism rate'],               example: 'Education programmes in prisons aim to reduce recidivism rates.' },
      { word: 'civil liberties',    definition: 'The rights of citizens to political and personal freedom',                  vietnamese: 'quyền tự do công dân', collocations: ['protect civil liberties', 'erode civil liberties'],     example: 'Emergency powers that erode civil liberties must be carefully scrutinised.' },
      { word: 'disenfranchise',     definition: 'To deprive a person of a right or privilege, especially the right to vote', vietnamese: 'tước quyền',        collocations: ['disenfranchise prisoners', 'politically disenfranchise'],  example: 'Permanently disenfranchising convicted felons is controversial in democratic societies.' },
      { word: 'mitigate',           definition: 'To lessen the severity of something, such as a crime or its consequences', vietnamese: 'giảm nhẹ',          collocations: ['mitigate the sentence', 'mitigating circumstances'],       example: 'Judges consider mitigating circumstances before imposing a sentence.' },
      { word: 'restorative justice', definition: 'An approach to justice focused on repairing harm through cooperation',    vietnamese: 'công lý phục hồi',  collocations: ['restorative justice programme', 'adopt restorative justice'], example: 'Restorative justice allows victims and offenders to engage in dialogue.' },
      { word: 'impartial',          definition: 'Treating all parties equally and fairly without favouritism or bias',       vietnamese: 'vô tư, khách quan', collocations: ['impartial judge', 'remain impartial'],                     example: 'Justice requires an impartial judiciary free from political interference.' },
      { word: 'due process',        definition: 'The legal requirement that the state must respect all legal rights owed to a person', vietnamese: 'quy trình tố tụng hợp pháp', collocations: ['right to due process', 'deny due process'],        example: 'Due process guarantees that no one can be deprived of liberty without fair legal proceedings.' },
      { word: 'penal system',       definition: 'The system of prisons and punishments used to deal with crime',             vietnamese: 'hệ thống hình sự',  collocations: ['reform the penal system', 'penal system effectiveness'],   example: 'Reforming the penal system to focus on rehabilitation rather than punishment is overdue.' },
      { word: 'organised crime',    definition: 'Criminal activities carried out by a structured group over a long period',  vietnamese: 'tội phạm có tổ chức', collocations: ['fight organised crime', 'organised crime network'],       example: 'Cross-border cooperation is essential to dismantle organised crime networks.' },
      { word: 'criminalisation',    definition: 'The process of making previously legal activities illegal',                  vietnamese: 'hình sự hóa',       collocations: ['criminalisation of poverty', 'debate criminalisation'],    example: 'The criminalisation of drug use is increasingly questioned by public health experts.' },
      { word: 'judicial independence', definition: 'The principle that the judiciary should be free from political pressure', vietnamese: 'độc lập tư pháp',   collocations: ['protect judicial independence', 'undermine judicial independence'], example: 'Judicial independence is a cornerstone of the rule of law.' },
    ],
    C2: [
      { word: 'abolitionism',       definition: 'The movement to abolish prisons, arguing they perpetuate systemic injustice', vietnamese: 'chủ nghĩa bãi bỏ nhà tù', collocations: ['prison abolitionism', 'abolitionist movement'],      example: 'Prison abolitionism argues that incarceration causes more harm than it prevents.' },
      { word: 'punitive populism',  definition: 'The tendency of politicians to advocate harsh punishments to win public support', vietnamese: 'chủ nghĩa dân túy trừng phạt', collocations: ['rise of punitive populism', 'punitive populist agenda'], example: 'Punitive populism drives policies that are politically popular but criminologically counterproductive.' },
      { word: 'carceral state',     definition: 'A society that relies heavily on incarceration as a form of social control', vietnamese: 'nhà nước nhà tù',   collocations: ['carceral state expansion', 'critique the carceral state'], example: 'The United States is frequently cited as the prime example of the carceral state.' },
      { word: 'nullification',      definition: 'The act of a jury refusing to convict despite clear evidence, based on conscience', vietnamese: 'bãi bỏ, phủ quyết', collocations: ['jury nullification', 'act of nullification'],            example: 'Jury nullification raises complex questions about the limits of judicial power.' },
      { word: 'prosecutorial discretion', definition: 'The power of a prosecutor to decide whether and how to bring charges', vietnamese: 'quyền tùy ý công tố', collocations: ['exercise prosecutorial discretion', 'limit prosecutorial discretion'], example: 'Critics argue that prosecutorial discretion is often exercised in racially biased ways.' },
      { word: 'legal positivism',   definition: 'The theory that law is a set of rules created by humans, separate from morality', vietnamese: 'thực chứng pháp lý', collocations: ['legal positivism theory', 'critique legal positivism'], example: 'Legal positivism holds that an unjust law is still a law and must be obeyed.' },
      { word: 'extraterritorial jurisdiction', definition: 'The ability of a state to exercise legal authority beyond its borders', vietnamese: 'quyền tài phán ngoài lãnh thổ', collocations: ['exercise extraterritorial jurisdiction', 'limits of extraterritorial jurisdiction'], example: 'Extraterritorial jurisdiction allows countries to prosecute their nationals for crimes committed abroad.' },
      { word: 'therapeutic jurisprudence', definition: 'An approach to law that considers its psychological and social effects on individuals', vietnamese: 'tư pháp trị liệu', collocations: ['principles of therapeutic jurisprudence', 'apply therapeutic jurisprudence'], example: 'Therapeutic jurisprudence underpins drug courts that prioritise treatment over punishment.' },
    ],
  },
};

/* ─── Essential Collocations ─────────────────────────────────────────────── */
const ESSENTIAL_COLLOCATIONS = {
  'Technology': [
    { phrase: 'rapid technological advancement', example: 'Rapid technological advancement has transformed how we communicate.' },
    { phrase: 'artificial intelligence', example: 'Artificial intelligence is increasingly used in medical diagnosis.' },
    { phrase: 'digital divide', example: 'The digital divide between urban and rural areas remains significant.' },
    { phrase: 'data privacy', example: 'Data privacy laws are becoming stricter across the globe.' },
    { phrase: 'cybersecurity threat', example: 'Businesses must invest in preventing cybersecurity threats.' },
    { phrase: 'digital literacy skills', example: 'Digital literacy skills are essential for modern employment.' },
    { phrase: 'automation of jobs', example: 'The automation of jobs is a growing concern for workers.' },
    { phrase: 'internet access', example: 'Universal internet access remains a goal in many developing nations.' },
    { phrase: 'social media platform', example: 'Social media platforms have changed how news is consumed.' },
    { phrase: 'screen time', example: 'Excessive screen time among children is a public health concern.' },
    { phrase: 'disruptive innovation', example: 'Disruptive innovation often renders existing business models obsolete.' },
    { phrase: 'algorithmic bias', example: 'Addressing algorithmic bias is crucial for fair AI systems.' },
  ],
  'Environment': [
    { phrase: 'carbon emissions', example: 'Reducing carbon emissions is essential to combating climate change.' },
    { phrase: 'renewable energy sources', example: 'Governments are investing in renewable energy sources to replace fossil fuels.' },
    { phrase: 'loss of biodiversity', example: 'Loss of biodiversity threatens entire ecosystems.' },
    { phrase: 'ecological footprint', example: 'Citizens in wealthy nations have a disproportionately large ecological footprint.' },
    { phrase: 'greenhouse gas emissions', example: 'International agreements aim to reduce greenhouse gas emissions.' },
    { phrase: 'sustainable development', example: 'Sustainable development balances economic growth with environmental protection.' },
    { phrase: 'combat climate change', example: 'Nations must cooperate to combat climate change effectively.' },
    { phrase: 'protect biodiversity', example: 'Conservation efforts are needed to protect biodiversity in rainforests.' },
    { phrase: 'environmental legislation', example: 'Stronger environmental legislation is needed to protect waterways.' },
    { phrase: 'plastic waste', example: 'Reducing plastic waste requires both policy change and consumer action.' },
    { phrase: 'deforestation rate', example: 'The deforestation rate in tropical regions has accelerated alarmingly.' },
    { phrase: 'carbon offset scheme', example: 'Carbon offset schemes allow businesses to compensate for their emissions.' },
  ],
  'Education': [
    { phrase: 'academic achievement', example: 'Socioeconomic background strongly influences academic achievement.' },
    { phrase: 'critical thinking skills', example: 'Schools should prioritise developing critical thinking skills.' },
    { phrase: 'standardised testing', example: 'Standardised testing is criticised for promoting rote learning.' },
    { phrase: 'vocational training', example: 'Vocational training programmes provide practical skills for employment.' },
    { phrase: 'lifelong learning', example: 'The modern economy demands a commitment to lifelong learning.' },
    { phrase: 'educational attainment', example: 'Educational attainment is the strongest predictor of earning potential.' },
    { phrase: 'social mobility', example: 'Education is widely seen as the key to social mobility.' },
    { phrase: 'academic pressure', example: 'Excessive academic pressure can harm students\' mental wellbeing.' },
    { phrase: 'digital literacy', example: 'Digital literacy is now a core skill in the modern curriculum.' },
    { phrase: 'curriculum design', example: 'Curriculum design should reflect the needs of a changing economy.' },
    { phrase: 'socioeconomic inequality', example: 'Socioeconomic inequality creates significant barriers to educational opportunity.' },
    { phrase: 'rote memorisation', example: 'Rote memorisation does not develop the analytical skills employers value.' },
  ],
  'Health': [
    { phrase: 'preventive healthcare', example: 'Investment in preventive healthcare reduces long-term medical costs.' },
    { phrase: 'mental wellbeing', example: 'Schools play a role in supporting students\' mental wellbeing.' },
    { phrase: 'sedentary lifestyle', example: 'A sedentary lifestyle is linked to increased risk of chronic disease.' },
    { phrase: 'life expectancy', example: 'Life expectancy has risen significantly in developed nations.' },
    { phrase: 'chronic disease', example: 'Chronic disease management places a heavy burden on healthcare systems.' },
    { phrase: 'healthcare system', example: 'A well-funded healthcare system is essential for public wellbeing.' },
    { phrase: 'mental health awareness', example: 'Increased mental health awareness has reduced stigma in many societies.' },
    { phrase: 'obesity epidemic', example: 'The obesity epidemic is linked to poor diet and inactivity.' },
    { phrase: 'accessible healthcare', example: 'Accessible healthcare should be a right, not a privilege.' },
    { phrase: 'mortality rate', example: 'Improved sanitation has dramatically reduced the infant mortality rate.' },
    { phrase: 'nutritional deficiency', example: 'Nutritional deficiency in childhood can have lifelong consequences.' },
    { phrase: 'pharmaceutical industry', example: 'The pharmaceutical industry must balance profit with public health needs.' },
  ],
  'Society': [
    { phrase: 'social cohesion', example: 'Immigration policy should promote social cohesion, not division.' },
    { phrase: 'social mobility', example: 'Widening inequality threatens social mobility across generations.' },
    { phrase: 'demographic shift', example: 'An ageing population represents a significant demographic shift.' },
    { phrase: 'welfare state', example: 'The welfare state provides a safety net for the most vulnerable.' },
    { phrase: 'marginalised communities', example: 'Policies must address the needs of marginalised communities.' },
    { phrase: 'ageing population', example: 'An ageing population places pressure on pension and healthcare systems.' },
    { phrase: 'urban-rural divide', example: 'The urban-rural divide in services and opportunities is widening.' },
    { phrase: 'social inequality', example: 'Tackling social inequality requires systemic policy change.' },
    { phrase: 'cultural integration', example: 'Cultural integration takes time and requires support from both sides.' },
    { phrase: 'gender equality', example: 'Gender equality remains an ongoing challenge in many workplaces.' },
    { phrase: 'community engagement', example: 'Community engagement is vital for effective local governance.' },
    { phrase: 'discrimination and prejudice', example: 'Discrimination and prejudice undermine social harmony.' },
  ],
  'Work & Career': [
    { phrase: 'work-life balance', example: 'Flexible working hours help employees maintain a healthy work-life balance.' },
    { phrase: 'remote working', example: 'Remote working has become widespread since the pandemic.' },
    { phrase: 'gig economy', example: 'The gig economy offers flexibility but often lacks job security.' },
    { phrase: 'career progression', example: 'Many employees prioritise career progression over salary.' },
    { phrase: 'labour market', example: 'Automation is fundamentally reshaping the labour market.' },
    { phrase: 'upskilling and reskilling', example: 'Upskilling and reskilling are essential in a rapidly changing economy.' },
    { phrase: 'workplace productivity', example: 'Flexible policies have been shown to improve workplace productivity.' },
    { phrase: 'entrepreneurial spirit', example: 'An entrepreneurial spirit drives innovation in competitive markets.' },
    { phrase: 'job insecurity', example: 'Rising job insecurity has increased anxiety among workers.' },
    { phrase: 'employee wellbeing', example: 'Organisations are increasingly investing in employee wellbeing programmes.' },
    { phrase: 'collaborative working', example: 'Collaborative working across departments improves outcomes.' },
    { phrase: 'redundancy and unemployment', example: 'Automation may lead to widespread redundancy and unemployment.' },
  ],
  'Crime & Law': [
    { phrase: 'deter crime', example: 'Visible policing is believed to deter crime in urban areas.' },
    { phrase: 'criminal justice system', example: 'The criminal justice system must balance punishment with rehabilitation.' },
    { phrase: 'recidivism rate', example: 'Education in prisons has been shown to reduce the recidivism rate.' },
    { phrase: 'civil liberties', example: 'Mass surveillance is seen as a threat to civil liberties.' },
    { phrase: 'rehabilitate offenders', example: 'Prison programmes aim to rehabilitate offenders and reduce reoffending.' },
    { phrase: 'enforce legislation', example: 'Governments must enforce legislation to protect citizens\' rights.' },
    { phrase: 'proportionate punishment', example: 'Courts aim to impose proportionate punishment for each offence.' },
    { phrase: 'crime prevention', example: 'Community-based crime prevention schemes have shown promising results.' },
    { phrase: 'accountability and transparency', example: 'Accountability and transparency are essential in law enforcement.' },
    { phrase: 'juvenile delinquency', example: 'Juvenile delinquency is often linked to poverty and lack of support.' },
    { phrase: 'organised crime', example: 'Organised crime networks are increasingly operating across borders.' },
    { phrase: 'restorative justice', example: 'Restorative justice focuses on repairing harm rather than punishing offenders.' },
  ],
};

/* ─── Baby Words → Academic Upgrades ────────────────────────────────────── */
const BABY_WORDS = {
  'Technology': [
    { weak: 'use',         upgrade: 'utilise / leverage / employ',         example: 'Businesses leverage AI to streamline operations.' },
    { weak: 'big',         upgrade: 'significant / substantial / major',   example: 'This represents a significant shift in consumer behaviour.' },
    { weak: 'bad',         upgrade: 'detrimental / harmful / adverse',     example: 'Excessive screen time has a detrimental effect on sleep.' },
    { weak: 'good',        upgrade: 'beneficial / advantageous / positive', example: 'Digital tools provide beneficial learning opportunities.' },
    { weak: 'make',        upgrade: 'generate / produce / create',         example: 'AI systems generate vast amounts of data each day.' },
    { weak: 'help',        upgrade: 'facilitate / enable / support',       example: 'Technology facilitates communication across borders.' },
    { weak: 'show',        upgrade: 'demonstrate / illustrate / indicate', example: 'Research demonstrates that screen time affects sleep.' },
    { weak: 'get',         upgrade: 'obtain / acquire / access',           example: 'Users can access information instantly online.' },
    { weak: 'need',        upgrade: 'require / necessitate / demand',      example: 'Modern jobs require proficient digital literacy skills.' },
    { weak: 'change',      upgrade: 'transform / alter / reshape',         example: 'Social media has fundamentally transformed communication.' },
    { weak: 'a lot of',    upgrade: 'a significant number of / considerable', example: 'A significant number of jobs are at risk of automation.' },
    { weak: 'think',       upgrade: 'argue / contend / assert',            example: 'Critics argue that AI perpetuates existing inequalities.' },
  ],
  'Environment': [
    { weak: 'hurt',        upgrade: 'damage / harm / devastate',           example: 'Deforestation devastates entire ecosystems.' },
    { weak: 'fix',         upgrade: 'address / mitigate / resolve',        example: 'Governments must address the root causes of pollution.' },
    { weak: 'cut down',    upgrade: 'reduce / decrease / minimise',        example: 'Nations must reduce their carbon emissions urgently.' },
    { weak: 'use up',      upgrade: 'deplete / exhaust / consume',         example: 'Humans are rapidly depleting the Earth\'s natural resources.' },
    { weak: 'save',        upgrade: 'conserve / preserve / protect',       example: 'Conservation efforts help preserve endangered habitats.' },
    { weak: 'dirty',       upgrade: 'contaminated / polluted / toxic',     example: 'Contaminated water sources pose a serious health risk.' },
    { weak: 'get worse',   upgrade: 'deteriorate / worsen / escalate',     example: 'The environmental crisis continues to deteriorate.' },
    { weak: 'big',         upgrade: 'extensive / widespread / significant', example: 'The environmental impact of aviation is extensive.' },
    { weak: 'important',   upgrade: 'critical / crucial / paramount',      example: 'Biodiversity conservation is critical for ecosystem stability.' },
    { weak: 'cause',       upgrade: 'contribute to / lead to / trigger',   example: 'Deforestation contributes to rising global temperatures.' },
  ],
  'Education': [
    { weak: 'learn',       upgrade: 'acquire / develop / cultivate',       example: 'Students acquire critical thinking through debate.' },
    { weak: 'teach',       upgrade: 'instruct / educate / facilitate',     example: 'Teachers facilitate independent thinking in learners.' },
    { weak: 'test',        upgrade: 'assess / evaluate / examine',         example: 'Standardised tests assess a narrow range of abilities.' },
    { weak: 'good at',     upgrade: 'proficient in / skilled in / competent at', example: 'Graduates must be proficient in digital tools.' },
    { weak: 'show',        upgrade: 'demonstrate / illustrate / indicate', example: 'Evidence demonstrates the benefits of early childhood education.' },
    { weak: 'help',        upgrade: 'support / foster / promote',          example: 'Interactive learning fosters student engagement.' },
    { weak: 'better',      upgrade: 'superior / enhanced / improved',      example: 'Inquiry-based methods yield improved critical thinking.' },
    { weak: 'hard',        upgrade: 'challenging / demanding / rigorous',  example: 'Rigorous academic programmes prepare students effectively.' },
    { weak: 'remember',    upgrade: 'retain / memorise / recall',          example: 'Students retain information better through active learning.' },
    { weak: 'get',         upgrade: 'achieve / attain / obtain',           example: 'Higher educational attainment leads to better employment.' },
  ],
  'Health': [
    { weak: 'sick',        upgrade: 'ill / unwell / afflicted',            example: 'Millions are afflicted by preventable chronic conditions.' },
    { weak: 'get better',  upgrade: 'recover / recuperate / improve',      example: 'Patients recover more quickly with early intervention.' },
    { weak: 'bad for you', upgrade: 'detrimental to health / harmful / hazardous', example: 'Processed foods are detrimental to long-term health.' },
    { weak: 'fat',         upgrade: 'obese / overweight / clinically overweight', example: 'Obese individuals face significantly higher health risks.' },
    { weak: 'old people',  upgrade: 'the elderly / older adults / senior citizens', example: 'The elderly are more vulnerable to respiratory illnesses.' },
    { weak: 'doctor',      upgrade: 'healthcare professional / clinician / physician', example: 'Clinicians recommend regular cardiovascular exercise.' },
    { weak: 'help',        upgrade: 'alleviate / treat / manage',          example: 'Exercise helps alleviate symptoms of mild depression.' },
    { weak: 'use',         upgrade: 'administer / prescribe / employ',     example: 'Doctors administer vaccines to prevent disease outbreaks.' },
    { weak: 'worry',       upgrade: 'concern / anxiety / distress',        example: 'Mental health concerns are rising among young people.' },
    { weak: 'fix',         upgrade: 'treat / cure / address',              example: 'Early diagnosis is key to treating chronic diseases effectively.' },
  ],
  'Society': [
    { weak: 'poor people', upgrade: 'people living in poverty / low-income individuals', example: 'Low-income individuals face systemic barriers to advancement.' },
    { weak: 'old',         upgrade: 'elderly / ageing / senior',           example: 'An ageing population creates pressure on pension systems.' },
    { weak: 'different',   upgrade: 'diverse / varied / heterogeneous',    example: 'A diverse society benefits from a range of perspectives.' },
    { weak: 'unfair',      upgrade: 'inequitable / unjust / discriminatory', example: 'The current tax system is widely seen as inequitable.' },
    { weak: 'fight',       upgrade: 'combat / tackle / address',           example: 'Governments must combat rising levels of social inequality.' },
    { weak: 'split up',    upgrade: 'fragment / divide / segregate',       example: 'Extreme inequality can fragment communities.' },
    { weak: 'a lot of',    upgrade: 'a significant proportion of / the majority of', example: 'A significant proportion of citizens rely on public transport.' },
    { weak: 'help',        upgrade: 'support / empower / assist',          example: 'Social programmes empower marginalised communities.' },
    { weak: 'make worse',  upgrade: 'exacerbate / intensify / aggravate',  example: 'Austerity measures can exacerbate social inequality.' },
    { weak: 'important',   upgrade: 'vital / essential / fundamental',     example: 'Social cohesion is fundamental to a stable democracy.' },
  ],
  'Work & Career': [
    { weak: 'job',         upgrade: 'occupation / profession / vocation',  example: 'Teaching is a vocation that demands dedication.' },
    { weak: 'fired',       upgrade: 'made redundant / dismissed / laid off', example: 'Thousands of workers were made redundant due to automation.' },
    { weak: 'boss',        upgrade: 'employer / manager / supervisor',     example: 'Effective managers support their teams\' development.' },
    { weak: 'work hard',   upgrade: 'demonstrate diligence / show dedication', example: 'Employees who demonstrate diligence are more likely to advance.' },
    { weak: 'not enough money', upgrade: 'underpaid / financially precarious', example: 'Many gig workers are underpaid and lack job security.' },
    { weak: 'get better at', upgrade: 'upskill / develop professionally / enhance competencies', example: 'Workers must upskill to remain relevant in a changing economy.' },
    { weak: 'work together', upgrade: 'collaborate / cooperate / work in partnership', example: 'Teams collaborate more effectively in flexible environments.' },
    { weak: 'tired',       upgrade: 'exhausted / burnt out / fatigued',    example: 'Overworked employees are at risk of burnout.' },
    { weak: 'start a business', upgrade: 'establish a venture / launch an enterprise', example: 'Many graduates aspire to establish their own ventures.' },
    { weak: 'choose',      upgrade: 'opt for / select / pursue',           example: 'Many professionals opt for remote work arrangements.' },
  ],
  'Crime & Law': [
    { weak: 'stop',        upgrade: 'deter / prevent / reduce',            example: 'Harsher penalties are intended to deter criminal activity.' },
    { weak: 'bad person',  upgrade: 'offender / perpetrator / criminal',   example: 'Rehabilitation programmes target repeat offenders.' },
    { weak: 'do again',    upgrade: 'reoffend / recidivate / repeat',      example: 'Without support, many offenders are likely to reoffend.' },
    { weak: 'put in prison', upgrade: 'incarcerate / imprison / detain',   example: 'Incarcerating non-violent offenders may not reduce crime.' },
    { weak: 'law',         upgrade: 'legislation / statute / regulation',  example: 'New legislation aims to tackle online fraud.' },
    { weak: 'punish',      upgrade: 'penalise / sentence / sanction',      example: 'Courts must penalise offenders proportionately.' },
    { weak: 'watch',       upgrade: 'monitor / surveil / oversee',         example: 'Authorities use CCTV to monitor public spaces.' },
    { weak: 'fair',        upgrade: 'impartial / equitable / just',        example: 'An impartial justice system treats all citizens equally.' },
    { weak: 'change',      upgrade: 'reform / restructure / overhaul',     example: 'The prison system requires fundamental reform.' },
    { weak: 'break a law', upgrade: 'violate / infringe / breach',         example: 'Those who violate data protection laws face heavy fines.' },
  ],
};

/* ─── Vocabulary Learning State ─────────────────────────────────────────── */
let vocabTopic = 'Technology';
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

  // Show/hide Task 2 idea scaffold toggle row (fields stay collapsed until user opens)
  const scaffoldToggleRow = document.getElementById('scaffold-toggle-row');
  const scaffoldFields = document.getElementById('scaffold-fields');
  if (taskType === 'task2') {
    if (scaffoldToggleRow) scaffoldToggleRow.classList.remove('hidden');
    // Fields stay collapsed — user opens manually
  } else {
    if (scaffoldToggleRow) scaffoldToggleRow.classList.add('hidden');
    if (scaffoldFields) { scaffoldFields.classList.add('hidden'); clearScaffold(); }
    const icon = document.getElementById('scaffold-toggle-icon');
    if (icon) icon.textContent = '▸';
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
function toggleScaffoldFields() {
  const fields = document.getElementById('scaffold-fields');
  const icon = document.getElementById('scaffold-toggle-icon');
  if (!fields) return;
  const open = !fields.classList.contains('hidden');
  fields.classList.toggle('hidden', open);
  if (icon) icon.textContent = open ? '▸' : '▾';
}

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
  // Filter by selected topic chip (task2 only; topic field present on built-in prompts)
  if (taskType === 'task2' && selectedTopic && selectedTopic !== 'random') {
    const topicFiltered = bank.filter(p => p.topic === selectedTopic);
    if (topicFiltered.length) bank = topicFiltered;
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
/* ─── Vocab Section Switching ────────────────────────────────────────────── */
let _vocabSection = 'words';

function switchVocabSection(section) {
  _vocabSection = section;
  ['words', 'collocations', 'baby-words'].forEach(s => {
    document.getElementById(`vl-section-${s}`)?.classList.toggle('hidden', s !== section);
    document.getElementById(`vl-tab-${s}`)?.classList.toggle('active', s === section);
  });
  if (section === 'collocations') renderCollocationsSection();
  if (section === 'baby-words') renderBabyWordsSection();
}

let _collocTopic = Object.keys(ESSENTIAL_COLLOCATIONS)[0];

function renderCollocationsSection() {
  const chipsEl = document.getElementById('vl-colloc-topic-chips');
  const listEl  = document.getElementById('vl-colloc-list');
  if (!chipsEl || !listEl) return;
  chipsEl.innerHTML = Object.keys(ESSENTIAL_COLLOCATIONS).map(t =>
    `<button class="vl-chip${t === _collocTopic ? ' active' : ''}" onclick="selectCollocTopic('${escapeHtml(t)}')">${t}</button>`
  ).join('');
  const items = ESSENTIAL_COLLOCATIONS[_collocTopic] || [];
  listEl.innerHTML = items.length
    ? items.map(c => `
        <div class="vl-colloc-card">
          <div class="vl-colloc-phrase">${escapeHtml(c.phrase)}</div>
          <div class="vl-colloc-example">"${escapeHtml(c.example)}"</div>
        </div>`).join('')
    : '<p style="color:var(--text-secondary)">No collocations for this topic.</p>';
}

function selectCollocTopic(t) { _collocTopic = t; renderCollocationsSection(); }

let _babyTopic = Object.keys(BABY_WORDS)[0];

function renderBabyWordsSection() {
  const chipsEl = document.getElementById('vl-baby-topic-chips');
  const listEl  = document.getElementById('vl-baby-list');
  if (!chipsEl || !listEl) return;
  chipsEl.innerHTML = Object.keys(BABY_WORDS).map(t =>
    `<button class="vl-chip${t === _babyTopic ? ' active' : ''}" onclick="selectBabyTopic('${escapeHtml(t)}')">${t}</button>`
  ).join('');
  const items = BABY_WORDS[_babyTopic] || [];
  listEl.innerHTML = items.length
    ? `<table class="vl-baby-table">
        <thead><tr><th>❌ Avoid</th><th>✅ Use instead</th><th>Example</th></tr></thead>
        <tbody>${items.map(b => `
          <tr>
            <td class="vl-baby-weak">${escapeHtml(b.weak)}</td>
            <td class="vl-baby-upgrade">${escapeHtml(b.upgrade)}</td>
            <td class="vl-baby-example"><em>${escapeHtml(b.example)}</em></td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p style="color:var(--text-secondary)">No entries for this topic.</p>';
}

function selectBabyTopic(t) { _babyTopic = t; renderBabyWordsSection(); }

function showVocabUpdateReminder() {
  showToast('To update vocab: open Claude Code and say "Update VOCAB_BANK, ESSENTIAL_COLLOCATIONS, or BABY_WORDS in public/app.js"', 8000);
}

/* ─── Export Vocab to Excel ──────────────────────────────────────────────── */
function exportVocabToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel library not loaded yet. Refresh and try again.');
    return;
  }
  const wb = XLSX.utils.book_new();
  const levels = ['B1', 'B2', 'C1', 'C2'];
  const topics = Object.keys(VOCAB_BANK);

  // One sheet per topic
  topics.forEach(topic => {
    const rows = [['Level', 'Word', 'Definition (EN)', 'Vietnamese', 'Collocations', 'Example']];
    levels.forEach(level => {
      const words = VOCAB_BANK[topic]?.[level] || [];
      words.forEach(w => {
        rows.push([
          level,
          w.word || '',
          w.definition || '',
          w.vietnamese || '',
          Array.isArray(w.collocations) ? w.collocations.join(' | ') : (w.collocations || ''),
          w.example || ''
        ]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Column widths
    ws['!cols'] = [
      { wch: 6 }, { wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 45 }, { wch: 55 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, topic.substring(0, 31)); // sheet name max 31 chars
  });

  // Summary sheet: all topics + levels flat
  const allRows = [['Topic', 'Level', 'Word', 'Definition (EN)', 'Vietnamese', 'Collocations', 'Example']];
  topics.forEach(topic => {
    levels.forEach(level => {
      (VOCAB_BANK[topic]?.[level] || []).forEach(w => {
        allRows.push([
          topic, level,
          w.word || '', w.definition || '', w.vietnamese || '',
          Array.isArray(w.collocations) ? w.collocations.join(' | ') : (w.collocations || ''),
          w.example || ''
        ]);
      });
    });
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(allRows);
  wsSummary['!cols'] = [
    { wch: 14 }, { wch: 6 }, { wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 45 }, { wch: 55 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'All Words');

  XLSX.writeFile(wb, 'IELTS_Vocab_Bank.xlsx');
  showToast('Vocab exported! Check your Downloads folder.');
}

/* ─── Vocab Learn Load ───────────────────────────────────────────────────── */
function loadVocabLearn() {
  switchVocabSection('words');
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
            <button class="vl-save-btn" id="vl-save-${i}" onclick="saveVocabWordFromPreview(${i},event)" title="Save to My Vocabulary">💾</button>
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

async function saveVocabWordFromPreview(idx, event) {
  event.stopPropagation();
  if (!token) { alert('Please log in to save words.'); return; }
  const w = _getVocabWords()[idx];
  if (!w) return;
  const btn = document.getElementById(`vl-save-${idx}`);
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
    if (btn) { btn.textContent = '✅'; btn.disabled = true; }
    showToast(`"${w.word}" saved to My Vocabulary!`);
  } catch (err) {
    alert('Save failed: ' + err.message);
  }
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

