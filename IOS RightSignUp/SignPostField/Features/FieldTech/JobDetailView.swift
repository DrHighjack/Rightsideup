import SwiftUI
import SwiftData
import PhotosUI
import MapKit

struct JobDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel: JobDetailViewModel
    @State private var techNotes = ""
    @State private var issueText = ""
    @State private var isShowingFlagSheet = false
    @State private var photoPickerItems: [PhotosPickerItem] = []
    @State private var capturedPhotos: [UIImage] = []

    init(jobId: String) {
        _viewModel = State(initialValue: JobDetailViewModel(jobId: jobId))
    }

    var body: some View {
        List {
            if let job = viewModel.job {
                Section("Order") {
                    LabeledContent("Address", value: job.order.address)
                    LabeledContent("Type", value: job.order.type.capitalized)
                    if let realtor = job.order.realtor {
                        LabeledContent("Realtor", value: "\(realtor.firstName) \(realtor.lastName)")
                    }
                    Button {
                        openInAppleMaps(address: job.order.address, lat: job.order.addressLat, lng: job.order.addressLng)
                    } label: {
                        Label("Directions", systemImage: "map")
                    }
                }

                if !job.isComplete {
                    Section("Complete Job") {
                        TextField("Notes", text: $techNotes, axis: .vertical)
                            .lineLimit(3...6)

                        PhotosPicker(selection: $photoPickerItems, maxSelectionCount: 5, matching: .images) {
                            Label("Add Photos (\(capturedPhotos.count))", systemImage: "camera")
                        }
                        .onChange(of: photoPickerItems) { _, items in
                            Task { await loadPhotos(items) }
                        }

                        Button {
                            Task {
                                await viewModel.completeJob(techNotes: techNotes, photos: capturedPhotos, context: modelContext)
                            }
                        } label: {
                            if viewModel.isSubmitting {
                                ProgressView()
                            } else {
                                Text("Mark Complete")
                            }
                        }
                        .disabled(techNotes.isEmpty || capturedPhotos.isEmpty || viewModel.isSubmitting)

                        Button("Flag Issue", role: .destructive) {
                            isShowingFlagSheet = true
                        }
                    }
                } else {
                    Section {
                        Label("Job Completed", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(BrandColor.success)
                    }
                }

                if job.startedAt == nil {
                    Section {
                        Button("Start Job") { Task { await viewModel.startJob() } }
                    }
                }
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage).foregroundStyle(.secondary).font(.footnote)
                }
            }
        }
        .navigationTitle("Job Detail")
        .sheet(isPresented: $isShowingFlagSheet) {
            NavigationStack {
                Form {
                    TextField("Describe the issue", text: $issueText, axis: .vertical)
                        .lineLimit(3...6)
                }
                .navigationTitle("Flag Issue")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Submit") {
                            Task {
                                await viewModel.flagIssue(issueText, context: modelContext)
                                isShowingFlagSheet = false
                            }
                        }
                        .disabled(issueText.isEmpty)
                    }
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { isShowingFlagSheet = false }
                    }
                }
            }
        }
        .task { await viewModel.load() }
    }

    private func loadPhotos(_ items: [PhotosPickerItem]) async {
        var images: [UIImage] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                images.append(image)
            }
        }
        capturedPhotos = images
    }

    private func openInAppleMaps(address: String, lat: Double?, lng: Double?) {
        if let lat, let lng {
            let placemark = MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
            let mapItem = MKMapItem(placemark: placemark)
            mapItem.name = address
            mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
        } else if let url = URL(string: "http://maps.apple.com/?daddr=\(address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
            UIApplication.shared.open(url)
        }
    }
}
