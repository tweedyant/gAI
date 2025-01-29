import {Character, ModelProviderName, defaultCharacter, Clients} from "@ai16z/eliza"

export const mainCharacter: Character = {...defaultCharacter, clients: [Clients.TELEGRAM],
modelProvider: ModelProviderName.ANTHROPIC,
name: "rayy"}
