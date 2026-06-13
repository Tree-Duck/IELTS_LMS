// Original sample content seeded into the LMS on first boot.
// Ships in code → survives Railway redeploys (which may wipe the data file).
// All text below is ORIGINAL, written for this project — not copied from any site.

const MODEL_ESSAY_SEED = [
  {
    task_type: 'task2',
    topic_category: 'Technology',
    band_estimate: 9,
    prompt: 'Some people believe that artificial intelligence will soon replace humans in most areas of work. To what extent do you agree or disagree?',
    essay: `Artificial intelligence is advancing at a remarkable pace, and some commentators argue that it will soon take over the majority of jobs. While I accept that AI will reshape many roles, I disagree with the claim that it will replace humans across most fields, because a great deal of work still depends on qualities that machines do not possess.

It is true that AI already outperforms people in narrow, rule-based tasks. Software can scan medical images, process insurance claims and translate documents faster and more consistently than any human employee. In these areas, automation will undoubtedly reduce the number of routine positions, and workers who ignore this trend risk being left behind.

However, the assumption that this will extend to most occupations overlooks how much modern work relies on judgement, empathy and creativity. A teacher must respond to a confused child, a manager must resolve a conflict between colleagues, and a nurse must comfort a frightened patient. These situations are unpredictable and emotionally complex, and they cannot be reduced to the patterns on which AI depends. Rather than replacing such workers, technology is far more likely to assist them, handling the repetitive parts of their jobs and freeing them to focus on people.

In conclusion, although AI will transform the workplace and eliminate certain routine roles, I do not believe it will replace humans in most areas of employment. The more realistic future is one of collaboration, in which people and intelligent machines each contribute what they do best.`,
    model_strengths: ['Clear position maintained throughout', 'Concession + rebuttal structure', 'Precise topic vocabulary', 'Well-developed examples']
  },
  {
    task_type: 'task2',
    topic_category: 'Environment',
    band_estimate: 8,
    prompt: 'Some people think that environmental problems should be solved by governments, while others believe individuals are responsible. Discuss both views and give your own opinion.',
    essay: `Environmental damage is one of the most pressing challenges of our time, and there is ongoing debate about who should take the lead in addressing it. While some argue that the responsibility lies with governments, others insist that individuals must act. In my view, both have an essential role to play.

Those who favour government action point out that only the state has the power to make large-scale change. Governments can pass laws to limit industrial pollution, invest in renewable energy and build efficient public transport. Without such measures, the efforts of ordinary citizens are unlikely to be enough, because the biggest sources of emissions are factories and power stations rather than households.

On the other hand, supporters of individual responsibility argue that public habits ultimately drive demand. If people choose to recycle, reduce their use of cars and avoid wasteful consumption, businesses and policymakers are forced to respond. Moreover, personal choices set an example and create the social pressure that pushes governments to act in the first place.

In my opinion, treating these as opposing positions is a mistake. Governments must create the framework and incentives that make sustainable living possible, but individuals must use these opportunities and change their daily behaviour. Real progress depends on the two working together.

To conclude, although governments hold the greater power to tackle environmental problems, individuals also bear genuine responsibility. The most effective solution combines firm policy with widespread personal commitment.`,
    model_strengths: ['Balanced discussion of both views', 'Clear personal opinion', 'Logical paragraphing', 'Cohesive linking']
  },
  {
    task_type: 'task2',
    topic_category: 'Education',
    band_estimate: 8,
    prompt: 'Some people believe that children should begin learning a foreign language at primary school rather than secondary school. Do the advantages of this outweigh the disadvantages?',
    essay: `In many countries, foreign languages are introduced only in secondary school, yet there is growing support for teaching them much earlier. Although starting at primary level brings a few difficulties, I believe the advantages clearly outweigh them.

The main benefit is that young children acquire languages with remarkable ease. Their brains are highly adaptable, so they absorb pronunciation and grammar more naturally than teenagers, who often struggle to sound fluent. An early start therefore lays a strong foundation and can lead to a far higher level of competence in adulthood. In addition, learning another language broadens children's minds, exposing them to different cultures and encouraging tolerance from a young age.

There are, admittedly, some drawbacks. Young pupils already have a demanding timetable, and adding a foreign language may increase pressure or reduce the time available for core subjects such as reading and mathematics. There is also a shortage of teachers trained to work with very young learners, which could result in poor-quality instruction.

Nevertheless, these problems can be managed. Languages can be taught through games and songs so that they feel enjoyable rather than burdensome, and governments can invest in proper teacher training to ensure high standards.

In conclusion, while introducing foreign languages at primary school poses certain challenges, the long-term gains in fluency and cultural awareness are significant. For this reason, I am convinced that the advantages outweigh the disadvantages.`,
    model_strengths: ['Direct answer to the question', 'Advantages and disadvantages weighed', 'Counter-arguments addressed', 'Strong conclusion']
  },
  {
    task_type: 'task1',
    topic_category: 'Line graph',
    chart_type: 'line_graph',
    band_estimate: 8,
    prompt: 'The line graph below shows the number of visitors (in thousands) to three types of attraction — museums, theme parks and beaches — in a coastal city between 2010 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    essay: `The line graph illustrates how many people, measured in thousands, visited museums, theme parks and beaches in a coastal city over the decade from 2010 to 2020.

Overall, visitor numbers rose for all three attractions during the period, but beaches were consistently the most popular while museums remained the least visited. The most striking change was the rapid growth in theme-park attendance.

In 2010, beaches attracted around 120,000 visitors, far more than theme parks and museums, which drew roughly 60,000 and 40,000 respectively. Beach numbers climbed steadily throughout the decade, reaching a peak of approximately 180,000 in 2020. Although they remained the leading attraction, their rate of growth was relatively modest.

Theme parks, by contrast, experienced dramatic expansion. After a slow start, their figures accelerated from 2014 onwards and almost trebled to about 170,000 by 2020, nearly overtaking beaches. Museums also grew, but far more gradually, rising from 40,000 to just under 80,000 over the same period.

In summary, while beaches stayed the most visited attraction across the decade, theme parks closed the gap considerably, and all three categories ended the period with substantially higher visitor numbers than they began with.`,
    model_strengths: ['Clear overview of main trends', 'Accurate use of data', 'Effective comparisons', 'Range of trend vocabulary']
  },
  {
    task_type: 'task1',
    topic_category: 'Bar chart',
    chart_type: 'bar_chart',
    band_estimate: 8,
    prompt: 'The bar chart below compares the average weekly hours spent on housework by men and women in four countries. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    essay: `The bar chart compares the average number of hours per week that men and women devoted to housework in four different countries.

Overall, women spent considerably more time on domestic tasks than men in every country shown. The gap between the sexes was widest in Country A and narrowest in Country D, where the figures were closest to equal.

In Country A, women carried out around 28 hours of housework each week, almost three times the figure for men, who spent only about 10 hours. A similar imbalance was evident in Country B, although the totals were lower: women there worked roughly 22 hours compared with 9 for men.

The remaining two countries showed a more balanced picture. In Country C, women's contribution fell to about 18 hours, while men's rose to 13. The most equal distribution appeared in Country D, where women spent approximately 15 hours and men 12, leaving a difference of just three hours.

In summary, although women undertook the larger share of housework throughout, the degree of inequality varied markedly, ranging from a substantial gap in Country A to near-parity in Country D.`,
    model_strengths: ['Clear overview identifying the key gap', 'Logical grouping of countries', 'Accurate comparisons', 'Varied comparative language']
  },
  {
    task_type: 'task1',
    topic_category: 'Pie chart',
    chart_type: 'pie_chart',
    band_estimate: 8,
    prompt: 'The pie charts below show the sources of electricity generation in a country in 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    essay: `The two pie charts show how electricity was generated in a particular country in 2000 and 2020, broken down by source.

Overall, the country shifted away from fossil fuels towards renewable energy over the twenty-year period. While coal dominated in 2000, its share had fallen sharply by 2020, when renewables had become far more significant.

In 2000, coal was by far the largest source, accounting for 55 per cent of electricity generation. Natural gas provided a further 25 per cent, meaning that fossil fuels together supplied four-fifths of the total. Renewable sources such as wind and solar were minor, contributing just 10 per cent, while nuclear power made up the remaining 10 per cent.

By 2020, the situation had changed considerably. Coal's share had more than halved to 20 per cent, and although natural gas remained at around 25 per cent, renewables had surged to 40 per cent, making them the leading source. Nuclear power saw a slight rise to 15 per cent.

In summary, the country substantially reduced its reliance on coal and increased its use of renewable energy, which transformed from a marginal source in 2000 into the dominant one by 2020.`,
    model_strengths: ['Clear overview of the energy shift', 'Accurate percentages', 'Effective period comparison', 'Cohesive structure']
  },
];

const COLLOCATION_SEED = [
  {
    topic: 'Education', level: 'B2',
    collocations: [
      { collocation: 'broaden your horizons', definition: 'to increase the range of your knowledge and experience', vietnamese: 'mở rộng tầm hiểu biết', example: 'Studying abroad really broadens your horizons.', part_of_speech: 'verb phrase' },
      { collocation: 'meet a deadline', definition: 'to finish something by the required time', vietnamese: 'kịp hạn nộp', example: 'Students must learn to meet deadlines for their assignments.', part_of_speech: 'verb phrase' },
      { collocation: 'a thirst for knowledge', definition: 'a strong desire to learn', vietnamese: 'khát khao tri thức', example: 'A good teacher inspires a thirst for knowledge.', part_of_speech: 'noun phrase' },
      { collocation: 'pass with flying colours', definition: 'to pass an exam easily and with a high mark', vietnamese: 'đỗ với điểm số xuất sắc', example: 'She passed the final exam with flying colours.', part_of_speech: 'idiom' },
      { collocation: 'fall behind', definition: 'to make less progress than others', vietnamese: 'tụt lại phía sau', example: 'He fell behind after missing several lessons.', part_of_speech: 'phrasal verb' },
    ]
  },
  {
    topic: 'Environment', level: 'B2',
    collocations: [
      { collocation: 'reduce carbon emissions', definition: 'to lower the amount of carbon dioxide released', vietnamese: 'giảm khí thải carbon', example: 'Switching to renewables helps reduce carbon emissions.', part_of_speech: 'verb phrase' },
      { collocation: 'renewable energy', definition: 'energy from sources that do not run out, such as sun and wind', vietnamese: 'năng lượng tái tạo', example: 'The country invested heavily in renewable energy.', part_of_speech: 'noun phrase' },
      { collocation: 'tackle climate change', definition: 'to deal with the problem of climate change', vietnamese: 'giải quyết biến đổi khí hậu', example: 'Governments must work together to tackle climate change.', part_of_speech: 'verb phrase' },
      { collocation: 'a throwaway culture', definition: 'a habit of discarding things rather than reusing them', vietnamese: 'văn hoá dùng một lần', example: 'A throwaway culture creates enormous amounts of waste.', part_of_speech: 'noun phrase' },
      { collocation: 'protect biodiversity', definition: 'to keep the variety of living species safe', vietnamese: 'bảo vệ đa dạng sinh học', example: 'National parks help protect biodiversity.', part_of_speech: 'verb phrase' },
    ]
  },
  {
    topic: 'Technology', level: 'C1',
    collocations: [
      { collocation: 'bridge the digital divide', definition: 'to reduce the gap between those with and without access to technology', vietnamese: 'thu hẹp khoảng cách số', example: 'Affordable internet can help bridge the digital divide.', part_of_speech: 'verb phrase' },
      { collocation: 'cutting-edge technology', definition: 'the most advanced and modern technology', vietnamese: 'công nghệ tiên tiến nhất', example: 'The lab is equipped with cutting-edge technology.', part_of_speech: 'noun phrase' },
      { collocation: 'data privacy', definition: 'the protection of personal information', vietnamese: 'quyền riêng tư dữ liệu', example: 'Users are increasingly concerned about data privacy.', part_of_speech: 'noun phrase' },
      { collocation: 'streamline a process', definition: 'to make a process more efficient', vietnamese: 'tối ưu hoá quy trình', example: 'Automation can streamline the production process.', part_of_speech: 'verb phrase' },
      { collocation: 'become obsolete', definition: 'to become out of date and no longer used', vietnamese: 'trở nên lỗi thời', example: 'Many gadgets become obsolete within a few years.', part_of_speech: 'verb phrase' },
    ]
  },
  {
    topic: 'Health', level: 'B1',
    collocations: [
      { collocation: 'a balanced diet', definition: 'eating a healthy mix of different foods', vietnamese: 'chế độ ăn cân bằng', example: 'A balanced diet keeps you healthy.', part_of_speech: 'noun phrase' },
      { collocation: 'stay in shape', definition: 'to keep your body fit', vietnamese: 'giữ dáng / khoẻ mạnh', example: 'She jogs every morning to stay in shape.', part_of_speech: 'verb phrase' },
      { collocation: 'get plenty of rest', definition: 'to sleep or relax enough', vietnamese: 'nghỉ ngơi đầy đủ', example: 'You should get plenty of rest before the exam.', part_of_speech: 'verb phrase' },
      { collocation: 'put on weight', definition: 'to become heavier', vietnamese: 'tăng cân', example: 'He put on weight during the holidays.', part_of_speech: 'phrasal verb' },
      { collocation: 'a healthy lifestyle', definition: 'a way of living that keeps you well', vietnamese: 'lối sống lành mạnh', example: 'Exercise is part of a healthy lifestyle.', part_of_speech: 'noun phrase' },
    ]
  },
  {
    topic: 'Work & Career', level: 'B2',
    collocations: [
      { collocation: 'pursue a career', definition: 'to follow a chosen profession over time', vietnamese: 'theo đuổi sự nghiệp', example: 'She decided to pursue a career in medicine.', part_of_speech: 'verb phrase' },
      { collocation: 'work-life balance', definition: 'the balance between time at work and personal life', vietnamese: 'cân bằng công việc và cuộc sống', example: 'Remote work can improve your work-life balance.', part_of_speech: 'noun phrase' },
      { collocation: 'gain experience', definition: 'to acquire practical knowledge through work', vietnamese: 'tích luỹ kinh nghiệm', example: 'Internships are a great way to gain experience.', part_of_speech: 'verb phrase' },
      { collocation: 'climb the career ladder', definition: 'to be promoted to higher positions', vietnamese: 'thăng tiến trong sự nghiệp', example: 'Hard work helped him climb the career ladder.', part_of_speech: 'idiom' },
      { collocation: 'take on responsibility', definition: 'to accept new duties', vietnamese: 'đảm nhận trách nhiệm', example: 'Junior staff gradually take on more responsibility.', part_of_speech: 'verb phrase' },
    ]
  },
  {
    topic: 'Society', level: 'C1',
    collocations: [
      { collocation: 'bridge the generation gap', definition: 'to reduce differences in attitudes between age groups', vietnamese: 'thu hẹp khoảng cách thế hệ', example: 'Shared activities can bridge the generation gap.', part_of_speech: 'verb phrase' },
      { collocation: 'a sense of community', definition: 'a feeling of belonging among people in an area', vietnamese: 'tinh thần cộng đồng', example: 'Local festivals foster a sense of community.', part_of_speech: 'noun phrase' },
      { collocation: 'tackle social inequality', definition: 'to deal with unfair differences between groups', vietnamese: 'giải quyết bất bình đẳng xã hội', example: 'Better education can help tackle social inequality.', part_of_speech: 'verb phrase' },
      { collocation: 'raise awareness', definition: 'to increase public knowledge of an issue', vietnamese: 'nâng cao nhận thức', example: 'The campaign aims to raise awareness of mental health.', part_of_speech: 'verb phrase' },
      { collocation: 'a law-abiding citizen', definition: 'a person who obeys the law', vietnamese: 'công dân tuân thủ pháp luật', example: 'Most people are law-abiding citizens.', part_of_speech: 'noun phrase' },
    ]
  },
];

const SPEAKING_ANSWER_SEED = [
  // ── Part 1 ──
  {
    part: 1, category: 'Hometown', band_estimate: 7,
    question: 'Do you live in a house or an apartment?',
    model_answer: `At the moment I live in a fairly small apartment on the fifth floor of a building in the city centre. It's not huge, but it suits me well because it's close to my university and there are plenty of cafés nearby. What I like most is the balcony, where I can sit and relax in the evening. I'd love to have a house with a garden one day, but for now the convenience of an apartment is hard to beat.`,
    key_phrases: ['it suits me well', 'close to', 'what I like most', 'hard to beat']
  },
  {
    part: 1, category: 'Work & Study', band_estimate: 7,
    question: 'What subject are you studying, and why did you choose it?',
    model_answer: `I'm currently studying business administration. I chose it mainly because I've always been interested in how companies are run, and I think it opens up a wide range of career options. To be honest, my parents also encouraged me a little, but the more I study, the more I genuinely enjoy it — especially the marketing side, which is surprisingly creative. So overall I'm really happy with my choice.`,
    key_phrases: ['mainly because', 'opens up a wide range of', 'to be honest', 'the more... the more...']
  },
  {
    part: 1, category: 'Hobbies', band_estimate: 8,
    question: 'What do you usually do in your free time?',
    model_answer: `In my free time I tend to do a mix of things depending on my mood. When I want to unwind, I'll read a novel or listen to music, but I'm also quite an active person, so I play badminton with friends two or three times a week. Recently I've taken up cooking as well, which I find really rewarding because you get to enjoy the results afterwards. Variety is what keeps it interesting for me.`,
    key_phrases: ['depending on my mood', 'unwind', 'taken up', 'really rewarding']
  },
  // ── Part 2 ──
  {
    part: 2, category: 'Places', band_estimate: 8,
    question: 'Describe a place you like to visit in your free time. You should say: where it is; how often you go there; what you do there; and explain why you like it.',
    model_answer: `I'd like to talk about a small lake on the edge of my city that I visit whenever I need to clear my head. It's only about twenty minutes away by bike, and I try to go there at least once a week, usually early on a Sunday morning before it gets crowded.

When I'm there, I normally walk around the path that circles the water, take a few photos and sometimes just sit on a bench with a coffee and a book. There's a lovely atmosphere — you can hear birds singing and watch people jogging or walking their dogs.

The main reason I like it so much is that it's a complete contrast to my busy daily life. As a student, I spend most of my time surrounded by screens and noise, so being in such a peaceful, green space helps me relax and recharge. I always come away feeling calmer and more focused, which is exactly why I keep going back.`,
    key_phrases: ['clear my head', 'a lovely atmosphere', 'a complete contrast to', 'relax and recharge', 'come away feeling']
  },
  {
    part: 2, category: 'People', band_estimate: 8,
    question: 'Describe a person who has influenced you. You should say: who the person is; how you know them; what they are like; and explain how they have influenced you.',
    model_answer: `The person I'd like to describe is my high-school English teacher, Ms Lan, who had a huge impact on me during my teenage years. I got to know her over three years, as she taught my class right up until graduation.

She was the kind of teacher who genuinely cared about her students. She was patient, endlessly encouraging and had a great sense of humour, so her lessons never felt boring. What really stood out, though, was how she treated mistakes — she always told us that getting things wrong was just part of learning.

She influenced me in two main ways. First, she gave me the confidence to speak English without being afraid of making errors, and that's a big reason I'm comfortable speaking today. Second, she inspired me to be more disciplined; seeing how hard she worked made me want to put in the same effort. Honestly, without her encouragement I don't think I'd have developed the love of languages that I have now.`,
    key_phrases: ['had a huge impact on me', 'genuinely cared', 'what really stood out', 'gave me the confidence', 'put in the same effort']
  },
  {
    part: 2, category: 'Experiences', band_estimate: 7,
    question: 'Describe a skill you would like to learn. You should say: what the skill is; how you would learn it; how long it would take; and explain why you want to learn it.',
    model_answer: `A skill I've wanted to learn for a long time is playing the guitar. I've always loved music, and there's something really appealing about being able to pick up an instrument and play a song for friends.

If I'm honest, I'd probably start by watching tutorials online, since there are so many free lessons available, and then maybe take a few classes with a proper teacher once I've learned the basics. I imagine it would take me at least a year of regular practice to get reasonably good, because I know it requires patience and a lot of repetition.

The main reason I want to learn it is for relaxation. I spend a lot of time studying, and I think having a creative hobby would be a great way to switch off and reduce stress. On top of that, it would be a nice way to connect with other people, since playing music together is always fun.`,
    key_phrases: ['really appealing', 'if I\'m honest', 'reasonably good', 'switch off', 'on top of that']
  },
  // ── Part 3 ──
  {
    part: 3, category: 'Society', band_estimate: 8,
    question: 'Why do you think more and more people are moving to live in cities?',
    model_answer: `I think the main driver is opportunity. Cities tend to offer far more in terms of jobs, education and healthcare than rural areas, so it's natural that people, especially the young, are drawn to them in search of a better life. On top of that, urban areas usually have better infrastructure and entertainment, which makes them appealing. Having said that, I do think this trend has downsides, such as overcrowding and rising living costs, so it isn't entirely positive.`,
    key_phrases: ['the main driver', 'in search of', 'on top of that', 'having said that', 'isn\'t entirely positive']
  },
  {
    part: 3, category: 'People', band_estimate: 8,
    question: 'Do you think famous people make good role models for young people?',
    model_answer: `That's an interesting question. In some cases they can be excellent role models — many celebrities use their influence to promote good causes or show that hard work pays off. However, I'd argue it really depends on the individual. Some famous people set a poor example through their behaviour, and because young people tend to imitate those they admire, that can be harmful. So rather than looking up to someone simply because they're famous, I think young people should focus on what that person actually stands for.`,
    key_phrases: ['in some cases', 'hard work pays off', 'I\'d argue', 'it depends on', 'look up to']
  },
  {
    part: 3, category: 'Education', band_estimate: 8,
    question: 'Do you think people will continue learning new skills throughout their lives in the future?',
    model_answer: `Absolutely — in fact I think lifelong learning will become essential rather than optional. The job market is changing so quickly, particularly because of technology, that the skills people learn at university may be out of date within a decade. As a result, workers will increasingly need to retrain and pick up new abilities just to stay relevant. The good news is that learning has never been more accessible, with online courses and tutorials available to almost everyone, so I'm fairly optimistic that people will adapt.`,
    key_phrases: ['lifelong learning', 'rather than optional', 'out of date', 'stay relevant', 'I\'m fairly optimistic']
  },
];

module.exports = { MODEL_ESSAY_SEED, COLLOCATION_SEED, SPEAKING_ANSWER_SEED };
