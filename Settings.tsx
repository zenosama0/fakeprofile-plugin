import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

const { ScrollView, View, Text, TextInput, StyleSheet, TouchableOpacity } = ReactNative;

export default function Settings() {
    useProxy(storage);
    storage.mutatedProfiles = storage.mutatedProfiles || [];
    
    const addProfile = () => {
        storage.mutatedProfiles.push({ id: "", pfp: "", displayName: "", bio: "", status: "" });
    };

    const removeProfile = (index: number) => {
        storage.mutatedProfiles.splice(index, 1);
    };

    const updateProfile = (index: number, key: string, value: string) => {
        storage.mutatedProfiles[index][key] = value;
    };

    return (
        <ScrollView style={styles.container}>
            {storage.mutatedProfiles.map((profile, index) => (
                <View key={index} style={styles.card}>
                    <Text style={styles.title}>Override Group #{index + 1}</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="User ID"
                        placeholderTextColor="#777"
                        value={profile.id}
                        onChangeText={(v) => updateProfile(index, 'id', v)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="PFP Link"
                        placeholderTextColor="#777"
                        value={profile.pfp}
                        onChangeText={(v) => updateProfile(index, 'pfp', v)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Display Name"
                        placeholderTextColor="#777"
                        value={profile.displayName}
                        onChangeText={(v) => updateProfile(index, 'displayName', v)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Bio"
                        placeholderTextColor="#777"
                        value={profile.bio}
                        onChangeText={(v) => updateProfile(index, 'bio', v)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Status"
                        placeholderTextColor="#777"
                        value={profile.status}
                        onChangeText={(v) => updateProfile(index, 'status', v)}
                    />

                    <TouchableOpacity style={styles.removeButton} onPress={() => removeProfile(index)}>
                        <Text style={styles.buttonText}>Remove Group</Text>
                    </TouchableOpacity>
                </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addProfile}>
                <Text style={styles.buttonText}>+ Add Profile Override</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    card: { backgroundColor: "#252538", padding: 12, borderRadius: 8, marginBottom: 16 },
    title: { color: "#fff", fontWeight: "bold", marginBottom: 8 },
    input: { backgroundColor: "#151522", color: "#fff", padding: 8, borderRadius: 4, marginBottom: 8 },
    addButton: { backgroundColor: "#5865F2", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 10 },
    removeButton: { backgroundColor: "#ED4245", padding: 8, borderRadius: 4, alignItems: "center", marginTop: 4 },
    buttonText: { color: "#fff", fontWeight: "bold" }
});
