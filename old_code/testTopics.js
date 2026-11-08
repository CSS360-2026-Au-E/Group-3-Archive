import identifyTopics from "./src/helpers/identifyTopics.js";

const sampleMessages = [
  { author: { username: "Noah" }, content: "Does anyone understand the math homework?" },
  { author: { username: "Vicky" }, content: "I'm stuck on the algebra questions." },
  { author: { username: "Ethan" }, content: "Anyone playing Minecraft tonight?" },
  { author: { username: "Emma" }, content: "Yes, let's play after dinner!" },
  { author: { username: "Spencer" }, content: "We should schedule our group project meeting." },
];

try {
  const topics = await identifyTopics(sampleMessages);
  console.log("Identified topics:", topics);
} catch (error) {
  console.error("Topic identification failed:", error.message);
}