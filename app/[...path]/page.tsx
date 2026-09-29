import Shop from '../shop';
import { requireChatGPTUser } from '../chatgpt-auth';
export default async function Page(){await requireChatGPTUser('/');return <Shop/>;}
